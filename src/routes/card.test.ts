import {afterAll, describe, expect, test} from "bun:test";
import app from "../index.ts";
import {jsonHeader, testUser} from "../lib/test.utils.ts";
import { seedDataAccounts, seedDataCards } from "../db/seed.ts";
import { db } from "../db/db.ts";
import { eq } from "drizzle-orm";
import { cards } from "../db/schema.ts";

describe("/api/card", () => {
    describe('create', () => {
        const testCardName =`test-card-${new Date()}` 
        afterAll(async () => {
            await db.delete(cards).where(eq(cards.name, testCardName))
        })
        test('error on invalid user', async () => {
            const res = await app.request(`/api/card/invalidUserId`, {
                method: "POST",
                body: JSON.stringify({
                    companyId: 1,
                    name: testCardName,
                    cardType: 'cashback',
                    cardNetwork: 'amex'
                }),
                ...jsonHeader,
            });
            expect(res.status).toBe(404);
        })
        test('error on already exists', async () => {
            const existingCard = seedDataCards[0] 
            const res = await app.request(`/api/card/${testUser.id}`, {
                method: "POST",
                body: JSON.stringify({
                    companyId: `${existingCard?.companyId}`,
                    name: `${existingCard?.name}`,
                    cardType: `${existingCard?.cardType}`,
                    cardNetwork: `${existingCard?.cardNetwork}`
                }),
                ...jsonHeader,
            });
            expect(res.status).toBe(409);
        })
        test('error on invalid account payload', async () => {
            const res = await app.request(`/api/card/${testUser.id}`, {
                method: "POST",
                body: JSON.stringify({
                    companyId: 9000,
                    name: testCardName,
                    cardType: 'invalidType'
                }),
                ...jsonHeader,
            });
            expect(res.status).toBe(400);
        })
        test('successfully', async () => {
            const res = await app.request(`/api/card/${testUser.id}`, {
                method: "POST",
                body: JSON.stringify({
                    companyId: 1,
                    name: testCardName,
                    cardType: 'cashback',
                    cardNetwork: 'amex'
                }),
                ...jsonHeader,
            });
            expect(res.status).toBe(200);
        })

    })
})
