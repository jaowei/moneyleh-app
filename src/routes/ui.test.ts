import {describe, test, expect} from "bun:test";
import app from "../index.ts";
import {jsonHeader, testUser} from "../lib/test.utils.ts";
import type {UserCardInsertSchema} from "../db/schema.ts";

const cardData: UserCardInsertSchema[] = [{
    cardNumber: 'test-card-num',
    cardId: 1,
    userId: testUser.id
}, {
    cardNumber: 'test-card-num-2',
    cardId: 2,
    userId: testUser.id
}]

describe('/api/ui', () => {
    describe('upload and handle files', () => {
        test('file upload: parse transactions', async () => {
            const formData = new FormData()
            const testFile = Bun.file('./test-files/dbsCard.pdf')
            formData.append('file', testFile)
            formData.append('userId', 'testUser1Id')
            const res = await app.request("/api/ui/fileUpload", {
                method: "POST",
                body: formData
            });
            expect(res.status).toBe(200);
            const result = await res.json() as { transactions: any[] }
            expect(result).toHaveProperty('transactions')
            expect(result.transactions.length).toBe(43)
        })

    })
    describe('assign to', () => {
        test('no user id given', async () => {
            const res = await app.request('/api/ui/assignTo/', {
                method: 'POST',
                body: JSON.stringify({
                    accountsIds: [1, 2],
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
                    accountsIds: [1, 2],
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
                    accountsIds: [1, 2],
                    cardData: [...cardData, {cardId: 1000, cardNumber: 'abcd', userId: testUser.id}]
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
                    accountsIds: [1, 2, 10000],
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
})