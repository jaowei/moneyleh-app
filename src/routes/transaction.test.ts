import {describe, expect, test, afterAll, spyOn} from "bun:test";
import app from "../index.ts";
import {jsonHeader, testTag} from "../lib/test.utils.ts";
import type {PostTransactionPayload} from "./transaction.ts";
import {testClassifierPath} from "../lib/descriptionTagger/descriptionTagger.ts";
import {testUser} from "../lib/test.utils.ts";
import {transactions, type TransactionsUpdateSchema, userAccounts} from "../db/schema.ts";
import {db} from "../db/db.ts";
import {eq} from "drizzle-orm";


describe('/api/transaction', () => {
    describe('create', () => {
        const fixedDate = 'fixed-date'
        const testTransaction = {
            transactionDate: new Date().toISOString(),
            description: 'test-description',
            currency: 'SGD',
            amount: 123,
            userId: testUser.id,
            accountId: 1,
            tags: [{
                id: 1,
                description: testTag.description
            }]
        }
        afterAll(async () => {
            const testFilePath = Bun.file(testClassifierPath)
            await testFilePath.delete()
            try {
                await db.delete(transactions).where(eq(transactions.transactionDate, fixedDate))
            } catch (e) {
                console.log('You probably need to delete a row from transactionsTag table')
            }
        })

        test('fails to insert into db: no transactions', async () => {
            const res = await app.request("/api/transaction", {
                method: "POST",
                body: JSON.stringify({
                    transactions: []
                }),
                ...jsonHeader,
            });
            expect(res.status).toBe(400);
        })

        test('inserts into db', async () => {
            const testTransactions: PostTransactionPayload = {
                transactions: [testTransaction]
            }
            const res = await app.request("/api/transaction", {
                method: "POST",
                body: JSON.stringify(testTransactions),
                ...jsonHeader,
            });
            expect(res.status).toBe(200);
            const result = await res.json() as { failed: any[] }
            expect(result.failed.length).toBe(0)
        })

        test('inserts into db: no tags', async () => {
            const testTransactions: PostTransactionPayload = {
                transactions: [{
                    ...testTransaction,
                    tags: []
                }]
            }
            const res = await app.request("/api/transaction", {
                method: "POST",
                body: JSON.stringify(testTransactions),
                ...jsonHeader,
            });
            expect(res.status).toBe(200);
            const result = await res.json() as { failed: any[] }
            expect(result.failed.length).toBe(0)
        })

        test('inserts into db: only once', async () => {
            const dbSpy = spyOn(db, 'insert')
            const testTransactions: PostTransactionPayload = {
                transactions: [{
                    ...testTransaction,
                    transactionDate: fixedDate,
                    tags: []
                }]
            }
            const res = await app.request("/api/transaction", {
                method: "POST",
                body: JSON.stringify(testTransactions),
                ...jsonHeader,
            });
            expect(res.status).toBe(200);
            const result = await res.json() as { failed: any[] }
            expect(result.failed.length).toBe(0)
            const secondRes = await app.request("/api/transaction", {
                method: "POST",
                body: JSON.stringify(testTransactions),
                ...jsonHeader,
            });
            expect(dbSpy).toBeCalledTimes(1)
            expect(secondRes.status).toBe(200)
        })

        test.only('inserts into db: invalid payload', async () => {
            const testTransactions: PostTransactionPayload = {
                transactions: [{
                    ...testTransaction,
                    tags: [],
                    cardId: 1
                }]
            }
            const res = await app.request("/api/transaction", {
                method: "POST",
                body: JSON.stringify(testTransactions),
                ...jsonHeader,
            });
            expect(res.status).toBe(400);
            expect(await res.text()).toInclude('both cannot be empty and filled')
        })
    })

    describe('get transactions', () => {
        test('get per user', async () => {
            const res = await app.request(`/api/transaction/${testUser.id}`, {
                method: 'GET'
            })
            expect(res.status).toBe(200)
        })
        test('get for an invalid user', async () => {
            const res = await app.request(`/api/transaction/invalidUserId`, {
                method: 'GET'
            })
            expect(res.status).toBe(404)
        })
    })

    describe('update transactions', () => {
        const transactionUpdatePayload: TransactionsUpdateSchema = {
            id: 1,
            amount: 999,
            description: 'I was updated!'
        }
        test('update a transaction', async () => {
            const res = await app.request("/api/transaction/", {
                method: "PATCH",
                body: JSON.stringify({
                    transactions: [transactionUpdatePayload]
                }),
                ...jsonHeader,
            });
            expect(res.status).toBe(200)
            const resData = await res.json() as { failed: any[] }
            expect(resData.failed).toHaveLength(0)
        })
        test('update an invalid transaction', async () => {
            const res = await app.request("/api/transaction/", {
                method: "PATCH",
                body: JSON.stringify({
                    transactions: [{
                        ...transactionUpdatePayload,
                        id: 100000,
                    }]
                }),
                ...jsonHeader,
            });
            expect(res.status).toBe(200)
            const resData = await res.json() as { failed: any[] }
            expect(resData.failed).toHaveLength(1)
        })
    })

    describe('create per card/account', () => {
        test('fails to insert into db: invalid file', async () => {
            const formData = new FormData()
            const testFile = Bun.file('./test-files/dbsCard.pdf')
            formData.append('file', testFile)
            formData.append('userId', testUser.id)
            formData.append('accountId', '1')
            const res = await app.request("/api/transaction/csv", {
                method: "POST",
                body: formData,
            });
            expect(res.status).toBe(400);
            expect(await res.text()).toInclude('text/csv')
        })
        test('fails to insert into db: no account/card id', async () => {
            const formData = new FormData()
            const testFile = Bun.file('./test-files/migrationTest.csv')
            formData.append('file', testFile)
            formData.append('userId', testUser.id)
            const res = await app.request("/api/transaction/csv", {
                method: "POST",
                body: formData,
            });
            expect(res.status).toBe(400);
            expect(await res.text()).toInclude('An account id or card id is required')
        })
        test('fails to insert into db: both account/card id', async () => {
            const formData = new FormData()
            const testFile = Bun.file('./test-files/migrationTest.csv')
            formData.append('file', testFile)
            formData.append('userId', testUser.id)
            formData.append('accountId', '1')
            formData.append('cardId', '1')
            const res = await app.request("/api/transaction/csv", {
                method: "POST",
                body: formData,
            });
            expect(res.status).toBe(400);
            expect(await res.text()).toInclude('An account id or card id is required')
        })
        test('fails to insert into db: unknown user', async () => {
            const formData = new FormData()
            const testFile = Bun.file('./test-files/migrationTest.csv')
            formData.append('file', testFile)
            formData.append('userId', 'whoareyou')
            formData.append('cardId', '1')
            const res = await app.request("/api/transaction/csv", {
                method: "POST",
                body: formData,
            });
            expect(res.status).toBe(404);
            expect(await res.text()).toInclude('not found')
        })
        test('fails to insert into db: account/card not assigned', async () => {
            const formData = new FormData()
            const testFile = Bun.file('./test-files/migrationTest.csv')
            formData.append('file', testFile)
            formData.append('userId', testUser.id)
            formData.append('accountId', '1')
            const res = await app.request("/api/transaction/csv", {
                method: "POST",
                body: formData,
            });
            expect(res.status).toBe(400);
            expect(await res.text()).toInclude('has not been assigned')
        })
        test.skip('inserts into db', async () => {
            // skipped for the time being until we can add transactions
            // TODO: unskip once we can rollback all insertions so we can test successfully
            const accountId = 1
            const testLabel = 'testlabel'
            await db.insert(userAccounts).values({
                userId: testUser.id,
                accountId,
                accountLabel: testLabel
            })
            const formData = new FormData()
            const testFile = Bun.file('./test-files/migrationTest.csv')
            formData.append('file', testFile)
            formData.append('userId', testUser.id)
            formData.append('accountId', `${accountId}`)
            const res = await app.request("/api/transaction/csv", {
                method: "POST",
                body: formData,
            });
            expect(res.status).toBe(200);
            expect(await res.text()).toInclude('has not been assigned')
            await db.delete(userAccounts).where(eq(userAccounts.accountLabel, testLabel))
        })
    })
})