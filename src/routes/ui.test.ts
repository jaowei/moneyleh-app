import {describe, test, expect} from "bun:test";
import app from "../index.ts";
import {jsonHeader} from "../lib/test-utils.ts";

describe('/api/ui', () => {
    describe('assign to', () => {
        test('no user id given', async () => {
            const res = await app.request('/api/ui/assignTo/', {
                method: 'POST',
                body: JSON.stringify({
                    accountsIds: [1, 2],
                    cardIds: [1, 2]
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
                    cardIds: [1, 2]
                }),
                ...jsonHeader
            })
            expect(res.status).toBe(404)
            expect(await res.text()).toInclude('was not found')

        })
        test('no ids given', async () => {
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
                    cardIds: [1, 2, 10000]
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
                    cardIds: [1, 2]
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
                    cardIds: [1, 2]
                }),
                ...jsonHeader
            })
            expect(res.status).toBe(200)
            expect(await res.text()).toInclude('Successfully added')
        })
    })
})