import { describe, test, expect, spyOn, beforeAll, afterAll } from "bun:test";
import {
    tagTransactions,
} from "./descriptionTagger.ts";
import { tags, type TransactionsInsertSchema } from "../../db/schema.ts";
import { testUser } from "../test.utils.ts";
import { BaseClassifier } from "./base-classifier.ts";
import { db } from "../../db/db.ts";
import { eq } from "drizzle-orm";

describe('description tagger', () => {
    const transactions: TransactionsInsertSchema[] = [{
        transactionDate: new Date().toISOString(),
        description: 'test-description',
        currency: 'SGD',
        amount: 123,
        userId: testUser.id
    }]
    const testLabelName = 'test-label-description-tagger'
    beforeAll(async () => {
        await db.insert(tags).values({ description: testLabelName })
    })
    afterAll(async () => {
        await db.delete(tags).where(eq(tags.description, testLabelName))
    })
    test('tag a transaction', async () => {
        const tagToInsert = {
            label: testLabelName,
            value: 1
        }
        spyOn(BaseClassifier.prototype, 'isValid').mockReturnValueOnce(true)
        spyOn(BaseClassifier.prototype, 'predict').mockResolvedValueOnce([tagToInsert])
        const tagged = await tagTransactions(transactions)
        expect(tagged.length).toBe(transactions.length)
        expect(tagged?.[0]?.tags?.[0]?.description).toBe(testLabelName)
    })
})