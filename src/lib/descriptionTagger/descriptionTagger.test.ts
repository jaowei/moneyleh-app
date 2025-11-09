import {describe, test, expect, afterEach, spyOn} from "bun:test";
import {
    initClassifier,
    saveClassifier,
    tagTransactions,
    testClassifierPath,
    trainClassifier
} from "./descriptionTagger.ts";
import type {TransactionsInsertSchema} from "../../db/schema.ts";
import {LogisticRegressionClassifier} from "natural";
import {testTag} from "../test.utils.ts";

afterEach(async () => {
    const file = Bun.file(testClassifierPath)
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
        const c = await initClassifier()
        expect(restoreSpy).not.toBeCalled()
        trainClassifier(c, {
            description: 'test-description',
            tag: testTag.description
        })

        await saveClassifier(c)

        const c2 = await initClassifier()
        expect(c2).toBeInstanceOf(LogisticRegressionClassifier)
        expect(restoreSpy).toBeCalled()

        const tagged = await tagTransactions(c, transactions)
        expect(tagged.length).toBe(transactions.length)
        expect(tagged[0]).toHaveProperty('tag')
    })
})