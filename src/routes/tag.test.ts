import {describe, expect, test} from "bun:test";
import app from '..'
import {jsonHeader} from "../lib/test.utils.ts";
import type {TagInsertSchema, TagSelectSchema} from "../db/schema.ts";

describe('/api/tag', () => {
    describe('create', () => {
        const tagPayload: TagInsertSchema = {
            description: `test-tag-${new Date()}`
        }
        test('Fails to create: invalid payload', async () => {
            const res = await app.request('/api/tag', {
                method: 'POST',
                ...jsonHeader,
                body: JSON.stringify({
                    tags: [{description: ''}]
                })
            })
            expect(res.status).toBe(400)
            expect(await res.text()).toInclude('expected string')
        })
        test('Fails to create: no payload', async () => {
            const res = await app.request('/api/tag', {
                method: 'POST',
                ...jsonHeader,
                body: JSON.stringify({
                    tags: []
                })
            })
            expect(res.status).toBe(400)
            expect(await res.text()).toInclude('expected array')
        })
        test('create: twice', async () => {
            const res = await app.request('/api/tag', {
                method: 'POST',
                ...jsonHeader,
                body: JSON.stringify({
                    tags: [tagPayload, tagPayload]
                })
            })
            expect(res.status).toBe(201)
            const resData = await res.json() as { created: any[] }
            expect(resData.created).toHaveLength(1)

            const res2 = await app.request('/api/tag', {
                method: 'POST',
                ...jsonHeader,
                body: JSON.stringify({
                    tags: [tagPayload]
                })
            })
            expect(res2.status).toBe(201)
            const resData2 = await res2.json() as { created: any[] }
            expect(resData2.created).toHaveLength(0)
        })
    })

    describe('get', () => {
        test('get invalid id', async () => {
            const res = await app.request('/api/tag/invalidId', {
                method: 'GET'
            })
            expect(res.status).toBe(404)
        })
        test('get by id', async () => {
            const res = await app.request('/api/tag/1', {
                method: 'GET'
            })
            expect(res.status).toBe(200)
            const resData = await res.json() as TagSelectSchema
            expect(resData.id).toBe(1)
        })
        test('get all', async () => {
            const res = await app.request('/api/tag', {
                method: 'GET'
            })
            expect(res.status).toBe(200)
            const resData = await res.json() as { data: TagSelectSchema[] }
            expect(resData.data.length).toBeGreaterThanOrEqual(1)
        })
    })

    describe.only('put', () => {
        test('Fails to update: no payload', async () => {
            const res = await app.request('/api/tag', {
                method: 'PUT',
                ...jsonHeader,
                body: JSON.stringify({
                    tags: []
                })
            })
            expect(res.status).toBe(400)
        })
        test('updates', async () => {
            const res = await app.request('/api/tag', {
                method: 'PUT',
                ...jsonHeader,
                body: JSON.stringify({
                    tags: [{
                        id: 1,
                        description: 'test-tag-updated!'
                    }]
                })
            })
            expect(res.status).toBe(200)
            const resData = await res.json() as { updated: any[]; failed: any[] }
            expect(resData.failed).toHaveLength(0)
            expect(resData.updated).toHaveLength(1)
        })
        test('Fails to update: invalid tag payload', async () => {
            const res = await app.request('/api/tag', {
                method: 'PUT',
                ...jsonHeader,
                body: JSON.stringify({
                    tags: [{
                        description: ''
                    }]
                })
            })
            expect(res.status).toBe(400)
            const resText = await res.text()
            expect(resText).toInclude('expected number')
            expect(resText).toInclude('expected string')
        })
    })
});