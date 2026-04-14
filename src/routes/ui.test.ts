import { describe, test, expect, spyOn, afterAll, beforeAll, afterEach, jest } from "bun:test";
import app from "../index.ts";
import { jsonHeader, testUser } from "../lib/test.utils.ts";
import { statements, userAccounts, type UserAccountsInsertSchema, type UserCardInsertSchema, userCards } from "../db/schema.ts";
import { db } from "../db/db.ts";
import { eq } from "drizzle-orm";


describe('/api/ui', () => {
    afterEach(async () => {
        await db.delete(userCards).where(eq(userCards.userId, testUser.id))
        await db.delete(userAccounts).where(eq(userAccounts.userId, testUser.id))
        await db.delete(statements).where(eq(statements.userId, testUser.id))
    })
    describe('upload and handle files', () => {
        beforeAll(async () => {
            await db.delete(userCards).where(eq(userCards.userId, testUser.id))
        })
        afterEach(() => {
            jest.restoreAllMocks()
        })
        test('file upload: parse transactions card', async () => {
            const formData = new FormData()
            const testFile = Bun.file('./test-files/dbsCard.pdf')
            formData.append('file', testFile)
            formData.append('userId', testUser.id)
            const res = await app.request("/api/ui/fileUpload", {
                method: "POST",
                body: formData
            });
            expect(res.status).toBe(200);
            const result = await res.json() as { taggedTransactions: any[] }
            expect(result).toHaveProperty('taggedTransactions')
            expect(result.taggedTransactions.length).toBe(2)
            expect(result.taggedTransactions[0].length).toBe(23)
            expect(result.taggedTransactions[1].length).toBe(20)
        })
        test('file upload: no user id', async () => {
            const formData = new FormData()
            const testFile = Bun.file('./test-files/dbsCard.pdf')
            formData.append('file', testFile)
            const res = await app.request("/api/ui/fileUpload", {
                method: "POST",
                body: formData
            });
            expect(res.status).toBe(400);
            const result = await res.text()
            expect(result).toInclude('expected string')
            expect(result).toInclude('userId')
        })
        test('file upload: parse transactions account', async () => {
            const formData = new FormData()
            const testFile = Bun.file('./test-files/dbsAccountStatement.pdf')
            formData.append('file', testFile)
            formData.append('userId', testUser.id)
            const res = await app.request("/api/ui/fileUpload", {
                method: "POST",
                body: formData
            });
            expect(res.status).toBe(200);
            const result = await res.json() as { taggedTransactions: any[] }
            expect(result.taggedTransactions).toBeArrayOfSize(2)
            expect(result.taggedTransactions[0].length).toBe(33)
            expect(result.taggedTransactions[1].length).toBe(0)

        })
        test('file upload: unknown statement', async () => {
            const formData = new FormData()
            const testFile = Bun.file('./test-files/sample.pdf')
            formData.append('file', testFile)
            formData.append('userId', testUser.id)
            const res = await app.request("/api/ui/fileUpload", {
                method: "POST",
                body: formData
            });
            expect(res.status).toBe(500);
            expect(res.statusText).toInclude('Unable to determine');
        })
    })
    describe('assign to', () => {
        const cardData: UserCardInsertSchema[] = [{
            cardLabel: 'test-card-num',
            cardId: 1,
            userId: testUser.id
        }, {
            cardLabel: 'test-card-num-2',
            cardId: 2,
            userId: testUser.id
        }]

        const accountData: UserAccountsInsertSchema = {
            accountId: 1,
            accountLabel: 'test-account-label-1',
            userId: testUser.id
        }
        test('no user id given', async () => {
            const res = await app.request('/api/ui/assignTo/', {
                method: 'POST',
                body: JSON.stringify({
                    accountData: [accountData],
                    cardData
                }),
                ...jsonHeader
            })
            expect(res.status).toBe(400)
            expect(await res.text()).toInclude('specify a user id')
        })
        test('invalid user id given', async () => {
            const res = await app.request('/api/ui/assignTo/someRandomId', {
                method: 'POST',
                body: JSON.stringify({
                    accountData: [accountData],
                    cardData
                }),
                ...jsonHeader
            })
            expect(res.status).toBe(404)
            expect(await res.text()).toInclude('was not found')

        })
        test('no card or account ids given', async () => {
            const res = await app.request('/api/ui/assignTo/someId', {
                method: 'POST',
                body: JSON.stringify({}),
                ...jsonHeader
            })
            expect(res.status).toBe(400)
            expect(await res.text()).toInclude('No ids to assign')

        })
        test('invalid card id given', async () => {
            const res = await app.request('/api/ui/assignTo/testUser1Id', {
                method: 'POST',
                body: JSON.stringify({
                    accountData: [accountData],
                    cardData: [...cardData, { cardId: 1000, cardNumber: 'abcd', userId: testUser.id }]
                }),
                ...jsonHeader
            })
            expect(res.status).toBe(400)
            expect(await res.text()).toInclude('does not exist')
        })
        test('invalid account id given', async () => {
            const res = await app.request('/api/ui/assignTo/testUser1Id', {
                method: 'POST',
                body: JSON.stringify({
                    accountData: [{
                        ...accountData,
                        accountId: 10000
                    }],
                    cardData
                }),
                ...jsonHeader
            })
            expect(res.status).toBe(400)
            expect(await res.text()).toInclude('does not exist')
        })
        test('assigns successfully', async () => {
            const res = await app.request('/api/ui/assignTo/testUser1Id', {
                method: 'POST',
                body: JSON.stringify({
                    accountsIds: [1, 2],
                    cardData
                }),
                ...jsonHeader
            })
            expect(res.status).toBe(200)
            expect(await res.text()).toInclude('Successfully added')
        })
    })
    describe('inventory', () => {
        test('gets all available inventory and users inventory', async () => {
            const res = await app.request(`/api/ui/availableInventory/${testUser.id}`)
            expect(res.status).toBe(200)
            const data = (await res.json()) as any
            expect(data).toHaveProperty("allAccounts")
            expect(data).toHaveProperty("allCards")
            expect(data).toHaveProperty("userAccounts")
            expect(data).toHaveProperty("userCards")
        })
    })
})