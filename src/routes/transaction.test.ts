import {describe, expect, test, afterEach, afterAll, beforeAll} from "bun:test";
import app from "../index.ts";
import {jsonHeader, testTag} from "../lib/test.utils.ts";
import type {PostTransactionPayload} from "./transaction.ts";
import {testClassifierPath} from "../lib/descriptionTagger/descriptionTagger.ts";
import {testUser} from "../lib/test.utils.ts";
import {transactions, type TransactionsUpdateSchema, transactionTags, userAccounts} from "../db/schema.ts";
import {db} from "../db/db.ts";
import {and, eq, inArray} from "drizzle-orm";


describe('/api/transaction', () => {
    const fixedDate = 'fixed-date'
    const testTransaction = {
        transactionDate: fixedDate,
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

    const transactionCleanup = async () => {
        try {
            const testFilePath = Bun.file(testClassifierPath)
            await testFilePath.delete()
        } catch {
            // passthrough
        }
        try {
            const txnToDelete = await db.select().from(transactions).where(eq(transactions.transactionDate, fixedDate))
            if (txnToDelete.length) {
                for (const target of txnToDelete) {
                    console.log('----- Deleting transaction!')
                    await db.delete(transactionTags).where(eq(transactionTags.transactionId, target.id))
                }
                await db.delete(transactions).where(eq(transactions.transactionDate, fixedDate))
            }
        } catch (e) {
            console.log('Error deleting', e)
            console.log('You probably need to delete a row from transactionsTag table')
        }
    }

    describe('create', () => {
        afterEach(async () => {
            await transactionCleanup()
        })

        test('does not insert into db: no transactions', async () => {
            const res = await app.request("/api/transaction", {
                method: "POST",
                body: JSON.stringify({
                    transactions: []
                }),
                ...jsonHeader,
            });
            expect(res.status).toBe(400);
        })

        test('inserts into db: no tags', async () => {
            const testTransactions: PostTransactionPayload = {
                transactions: [{
                    ...testTransaction,
                }]
            }
            const res = await app.request("/api/transaction", {
                method: "POST",
                body: JSON.stringify(testTransactions),
                ...jsonHeader,
            });
            expect(res.status).toBe(201);
        })

        test('does not insert into db: invalid tag', async () => {
            const testTransactions: PostTransactionPayload = {
                transactions: [{
                    ...testTransaction,
                    tags: [{
                        id: 1,
                        description: ''
                    }]
                }]
            }
            const res = await app.request("/api/transaction", {
                method: "POST",
                body: JSON.stringify(testTransactions),
                ...jsonHeader,
            });
            expect(res.status).toBe(400);
            expect(await res.text()).toInclude('Too small')
        })

        test('does not insert into db: tag not in db', async () => {
            const testTransactions: PostTransactionPayload = {
                transactions: [{
                    ...testTransaction,
                    tags: [{
                        id: 100000,
                        description: 'some-random-tag'
                    }]
                }]
            }
            const res = await app.request("/api/transaction", {
                method: "POST",
                body: JSON.stringify(testTransactions),
                ...jsonHeader,
            });
            expect(res.status).toBe(400);
            expect(await res.text()).toInclude('Tag does not exist')
        })

        test('inserts into db: only once, test db transaction', async () => {
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
            expect(res.status).toBe(201);

            const txnNotAdded = {
                ...testTransaction,
                amount: 777,
                description: 'desc2'
            }
            const secondRes = await app.request("/api/transaction", {
                method: "POST",
                body: JSON.stringify({
                    transactions: [
                        txnNotAdded,
                        ...testTransactions.transactions,
                    ]
                }),
                ...jsonHeader,
            });
            expect(secondRes.status).toBe(400)
            expect(await secondRes.text()).toInclude('similar transaction')
            const queryRes = db.select().from(transactions).where(
                and(
                    eq(transactions.amount, txnNotAdded.amount),
                    eq(transactions.description, txnNotAdded.description)
                )
            ).all()
            expect(queryRes.length).toBe(0)
        })

        test('does not insert into db: invalid payload', async () => {
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

    describe('create then get', () => {
        afterAll(async () => await transactionCleanup())

        test('inserts into db', async () => {
            const testTransactions: PostTransactionPayload = {
                transactions: [
                    testTransaction,
                    {
                        ...testTransaction,
                        accountId: undefined,
                        amount: 1234,
                        cardId: 1
                    }]
            }
            const res = await app.request("/api/transaction", {
                method: "POST",
                body: JSON.stringify(testTransactions),
                ...jsonHeader,
            });
            expect(res.status).toBe(201);
        })

        test('get per user per account', async () => {
            const res = await app.request(`/api/transaction/${testUser.id}?type=account&accountId=1`, {
                method: 'GET'
            })
            expect(res.status).toBe(200)
            const resData = await res.json() as { transactions: any[] }
            expect(resData.transactions.length).toBe(1)
            expect(resData.transactions[0].accountName).toBe("multiplier")
            expect(resData.transactions[0].tags[0].description).toBe(testTag.description)
        })

        test('get per user per card', async () => {
            const res = await app.request(`/api/transaction/${testUser.id}?type=card&cardId=1`, {
                method: 'GET'
            })
            expect(res.status).toBe(200)
            const resData = await res.json() as { transactions: any[] }
            expect(resData.transactions.length).toBe(1)
            expect(resData.transactions[0].cardName).toBe("altitude visa signature")
            expect(resData.transactions[0].tags[0].description).toBe(testTag.description)
        })
    });

    describe('get transactions', () => {
        test('get for an invalid user', async () => {
            const res = await app.request(`/api/transaction/invalidUserId?type=card&cardId=1`, {
                method: 'GET'
            })
            expect(res.status).toBe(404)
        })

        test('get per user invalid query', async () => {
            const res = await app.request(`/api/transaction/${testUser.id}?type=card&accountId=1`, {
                method: 'GET'
            })
            expect(res.status).toBe(400)
            expect(await res.text()).toInclude('received NaN')
        })

        test('get per user missing some id param', async () => {
            const res = await app.request(`/api/transaction/${testUser.id}?type=card`, {
                method: 'GET'
            })
            expect(res.status).toBe(400)
            expect(await res.text()).toInclude('received NaN')
        })

        test('get per user missing type param', async () => {
            const res = await app.request(`/api/transaction/${testUser.id}?accountId=1`, {
                method: 'GET'
            })
            expect(res.status).toBe(400)
            expect(await res.text()).toInclude('Invalid input')
        })

        test('get per user no transactions per filter', async () => {
            const res = await app.request(`/api/transaction/${testUser.id}?type=account&accountId=1000`, {
                method: 'GET'
            })
            expect(res.status).toBe(200)
            const resData = await res.json() as any
            expect(resData.transactions).toBeArrayOfSize(0)
        })
    })

    describe('update transactions', () => {
        beforeAll(async () => {
            await db.insert(transactions).values({
                id: 1,
                transactionDate: 'test-date',
                amount: 0,
                description: 'test-description',
                currency: 'SGD',
                userId: testUser.id
            }).onConflictDoNothing()
        })
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

        describe('insert and delete all', () => {
            afterAll(async () => {
                const testTxns = await db.select().from(transactions).where(eq(transactions.userId, testUser.id))
                const testTxnIds = testTxns.map((t) => t.id)
                await db.delete(transactionTags).where(inArray(transactionTags.transactionId, testTxnIds))
                await db.delete(transactions).where(eq(transactions.userId, testUser.id))
                await db.delete(userAccounts).where(eq(userAccounts.userId, testUser.id))
            })
            test('inserts into db', async () => {
                const accountId = 1
                await db.insert(userAccounts).values({
                    userId: testUser.id,
                    accountId,
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
                expect(res.status).toBe(201);
                const sampleTxns = db.select().from(transactions).where(eq(transactions.userId, testUser.id)).limit(5).all()
                expect(sampleTxns?.[0]?.userId).toBe(testUser.id)
            })
        })
    })
})