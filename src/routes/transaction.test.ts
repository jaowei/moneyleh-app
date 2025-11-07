import {describe, expect, test, afterAll} from "bun:test";
import app from "../index.ts";
import {jsonHeader} from "../lib/test-utils.ts";
import type {PostTransactionPayload} from "./transaction.ts";
import {testClassifierPath} from "../lib/descriptionTagger/descriptionTagger.ts";

afterAll(async () => {
    const testFilePath = Bun.file(testClassifierPath)
    await testFilePath.delete()
})

describe('/api/transaction', () => {
    describe('create', () => {
        test('file upload: parse transactions', async () => {
            const formData = new FormData()
            const testFile = Bun.file('./test-files/dbsCard.pdf')
            formData.append('file', testFile)
            formData.append('userId', 'testUser1Id')
            const res = await app.request("/api/transaction/fileUpload", {
                method: "POST",
                body: formData
            });
            expect(res.status).toBe(200);
            const result = await res.json() as { transactions: any[] }
            expect(result).toHaveProperty('transactions')
            expect(result.transactions.length).toBe(43)
        })

        test('fails to insert into db: no transactions', async () => {
            const res = await app.request("/api/transaction/", {
                method: "POST",
                body: JSON.stringify({
                    transactions: []
                }),
                ...jsonHeader,
            });
            expect(res.status).toBe(400);
        })

        test('inserts into db', async () => {
            const testTransaction: PostTransactionPayload = {
                transactions: [{
                    transactionDate: new Date().toISOString(),
                    description: 'test-description',
                    currency: 'SGD',
                    amount: 123,
                    tag: {
                        id: 1,
                        description: 'test-tag'
                    }
                }]
            }
            const res = await app.request("/api/transaction/", {
                method: "POST",
                body: JSON.stringify(testTransaction),
                ...jsonHeader,
            });
            expect(res.status).toBe(200);
            const result = await res.json() as { failed: any[] }
            expect(result.failed.length).toBe(0)
        })
    })
})