import {afterAll, describe, expect, test} from "bun:test";
import app from "..";
import {jsonHeader, testUser} from "../lib/test.utils.ts";
import { seedDataAccounts } from "../db/seed.ts";
import { db } from "../db/db.ts";
import { eq } from "drizzle-orm";
import { accounts } from "../db/schema.ts";

describe("/api/account", () => {
    describe('create', () => {
        const testAccountName =`test-account-${new Date()}` 
        afterAll(async () => {
            await db.delete(accounts).where(eq(accounts.name, testAccountName))
        })
        test('error on invalid user', async () => {
            const res = await app.request(`/api/account/invalidUserId`, {
                method: "POST",
                body: JSON.stringify({
                    companyId: 1,
                    name: testAccountName,
                    accountType: 'cash'
                }),
                ...jsonHeader,
            });
            expect(res.status).toBe(404);
        })
        test('error on already exists', async () => {
            const existingAccount =seedDataAccounts[0] 
            const res = await app.request(`/api/account/${testUser.id}`, {
                method: "POST",
                body: JSON.stringify({
                    companyId: 1,
                    name: `${existingAccount?.name}`,
                    accountType: `${existingAccount?.accountType}`
                }),
                ...jsonHeader,
            });
            expect(res.status).toBe(409);
        })
        test('error on invalid account payload', async () => {
            const res = await app.request(`/api/account/${testUser.id}`, {
                method: "POST",
                body: JSON.stringify({
                    companyId: 9000,
                    name: testAccountName,
                    accountType: 'invalidType'
                }),
                ...jsonHeader,
            });
            expect(res.status).toBe(400);
        })
        test('successfully', async () => {
            const res = await app.request(`/api/account/${testUser.id}`, {
                method: "POST",
                body: JSON.stringify({
                    companyId: 1,
                    name: testAccountName,
                    accountType: 'cash'
                }),
                ...jsonHeader,
            });
            expect(res.status).toBe(200);
        })

    })
})
