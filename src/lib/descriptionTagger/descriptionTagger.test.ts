import {describe, test, expect, afterAll, spyOn} from "bun:test";
import {initClassifier, saveClassifier, tagTransactions, trainClassifier} from "./descriptionTagger.ts";
import type {TransactionsInsertSchema} from "../../db/schema.ts";
import {LogisticRegressionClassifier} from "natural";

const testDataPath = 'test-classifier-data.json'

afterAll(async () => {
    const file = Bun.file(testDataPath)
    await file.delete()
})

describe('description tagger', () => {
    const transactions: TransactionsInsertSchema[] = [{
        transactionDate: new Date().toISOString(),
        description: 'test-description',
        currency: 'SGD',
        amount: 123,
    }]
    test('tag a transaction', async () => {
        const tagged = await tagTransactions(undefined, transactions)
        expect(tagged.length).toBe(transactions.length)
        expect(tagged[0]).not.toHaveProperty('tag')
    })

    test('add documents and save', async () => {
        const restoreSpy = spyOn(LogisticRegressionClassifier, 'restore')
        const c = await initClassifier('nofile.json')
        expect(restoreSpy).not.toBeCalled()
        trainClassifier(c, {
            description: 'test-description',
            tag: 'test-tag'
        })

        await saveClassifier(c, testDataPath)

        const c2 = await initClassifier(testDataPath)
        expect(c2).toBeInstanceOf(LogisticRegressionClassifier)
        expect(restoreSpy).toBeCalled()
    })

    test('tag a transaction after training', async () => {
        const c = await initClassifier(testDataPath)
        const tagged = await tagTransactions(c, transactions)
        expect(tagged.length).toBe(transactions.length)
        expect(tagged[0]).toHaveProperty('tag')
    })
})