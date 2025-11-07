import {Hono} from "hono";
import z from "zod";
import {zodValidator} from "../lib/middleware/zod-validator.ts";
import {db} from "../db/db.ts";
import {accounts, cards, userAccounts, userCardInsertSchemaZ, userCards, userCompanies} from "../db/schema.ts";
import {eq, inArray} from "drizzle-orm";
import {appLogger} from "../index.ts";
import {HTTPException} from "hono/http-exception";
import {user} from "../db/auth-schema.ts";

export const uiRoute = new Hono()

const userAssignmentsZ = z.object({
    accountsIds: z.array(z.number()).optional(),
    cardData: z.array(userCardInsertSchemaZ).optional(),
})

uiRoute.post("/assignTo/:userId", zodValidator(userAssignmentsZ),
    async (c) => {
        const userId = c.req.param("userId")
        const {accountsIds, cardData} = c.req.valid('json')
        if (!accountsIds?.length && !cardData?.length) {
            c.status(400)
            return c.text('No ids to assign!')
        }

        const targetUser = await db.select().from(user).where(eq(user.id, userId))

        if (!targetUser.length) {
            throw new HTTPException(404, {
                message: `user id: ${userId} was not found!`
            })
        }

        // insert into the associative tables
        // TODO: Add transaction here once drizzle fixes their bug
        // https://github.com/drizzle-team/drizzle-orm/issues/1472
        try {
            const companiesSet = new Set<number>()
            if (accountsIds) {
                appLogger(`${accountsIds.length} account id's provided, inserting...`)
                await db.insert(userAccounts).values(accountsIds.map((acctId) => ({
                    userId,
                    accountId: acctId
                }))).onConflictDoNothing()
                appLogger(`${accountsIds.length} account id's inserted, getting companies...`)
                const companiesForAccounts = await db.selectDistinct({companyId: accounts.companyId}).from(accounts).where(inArray(accounts.id, accountsIds))
                companiesForAccounts.forEach((companyData) => {
                    if (companyData.companyId) {
                        companiesSet.add(companyData.companyId)
                    }
                })
            }
            if (cardData) {
                appLogger(`${cardData.length} card id's provided, inserting...`)
                await db.insert(userCards).values(cardData.map((d) => (
                    {
                        userId,
                        cardId: d.cardId,
                        cardNumber: d.cardNumber
                    }
                ))).onConflictDoNothing()
                appLogger(`${cardData.length} card id's inserted, getting companies...`)
                const cardIds = cardData.map((d) => d.cardId)
                const companiesForCards = await db.selectDistinct({companyId: cards.companyId}).from(cards).where(inArray(cards.id, cardIds))
                companiesForCards.forEach((companyData) => {
                    if (companyData.companyId) {
                        companiesSet.add(companyData.companyId)
                    }
                })
            }
            appLogger(`${companiesSet.size} companies to be added`)

            // insert to user company associative table
            await db.insert(userCompanies).values([...companiesSet].map((id) => ({
                userId,
                companyId: id
            }))).onConflictDoNothing()
            return c.text(`Successfully added ${accountsIds?.length} accounts, ${cardData?.length} cards, and ${companiesSet.size} companies to user`)
        } catch (e) {
            appLogger(`${e}`)
            if (e instanceof Error && e.message.includes("FOREIGN")) {
                throw new HTTPException(400, {
                    message: 'one of the ids provided does not exist!'
                })
            }
            throw new HTTPException(400, {
                message: `${e}`
            })
        }
    })

uiRoute.post('/assignTo/*', async (c) => {
    return c.text('Please specify a user id', 400)
})