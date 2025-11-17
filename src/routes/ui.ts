import {Hono} from "hono";
import z from "zod";
import {db} from "../db/db.ts";
import {
    accounts,
    cards,
    userAccounts,
    userCardInsertSchemaZ,
    userCards,
    userCompanies
} from "../db/schema.ts";
import {and, eq, inArray} from "drizzle-orm";
import {appLogger} from "../index.ts";
import {HTTPException} from "hono/http-exception";
import {findUserOrThrow} from "./route.utils.ts";
import type {StatementData} from "../lib/pdf/pdf.type.ts";
import {pdfParser} from "../lib/pdf/pdf.ts";
import {type TaggedTransaction, tagTransactions} from "../lib/descriptionTagger/descriptionTagger.ts";
import {zValidator} from "@hono/zod-validator";

const userAssignmentsZ = z.object({
    accountsIds: z.array(z.number()).optional(),
    cardData: z.array(userCardInsertSchemaZ).optional(),
})

const FileUploadPayloadZ = z.object({
    // min 5kb, max 150kb
    userId: z.string(),
    file: z.file().mime(["application/pdf", "text/csv", "application/vnd.ms-excel"]).min(5 * 1000).max(150 * 1000)
})

export const uiRoute = new Hono().post("/assignTo/:userId", zValidator('json', userAssignmentsZ),
    async (c) => {
        const userId = c.req.param("userId")
        const {accountsIds, cardData} = c.req.valid('json')
        if (!accountsIds?.length && !cardData?.length) {
            c.status(400)
            return c.text('No ids to assign!')
        }

        await findUserOrThrow(userId)

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
    }).post('/assignTo/*', async (c) => {
    return c.text('Please specify a user id', 400)
}).post("/fileUpload", zValidator('form', FileUploadPayloadZ), async (c) => {
    const {file, userId} = c.req.valid('form')

    let statementData: StatementData | undefined = undefined
    // TODO: How to prevent duplicate statement upload
    switch (file.type) {
        case 'application/pdf':
            statementData = await pdfParser(file)
            break;
        // case "application/vnd.ms-excel":
        //     console.log('I am xls')
        //     break;
        // case "text/csv":
        //     console.log('I am csv')
        //     break;
        default:
            // if zod validation fails somehow...
            throw new HTTPException(400, {
                message: `Unknown file type`
            })
    }

    const taggedTransactions: Array<TaggedTransaction & {
        accountName: string;
        cardId?: number | null;
        accountId?: number | null;
    }> = []
    if ('cards' in statementData) {
        for (const [cardName, data] of Object.entries(statementData.cards)) {
            let targetCard
            const cardRes = await db.select().from(cards).where(inArray(cards.name, cardName.toLowerCase().split(' ')))
            if (!cardRes.length) {
                appLogger(`Card with name : ${cardName} not found in database, refining search...`)
                // TODO: try to refind card again
                // TODO: else try to insert card
                throw new HTTPException(404, {
                    message: 'Card does not exist, please add a card to continue'
                })
            } else {
                targetCard = cardRes[0]
            }

            if (!targetCard) {
                throw new HTTPException()
            }
            const userCardRes = await db.select().from(userCards).where(and(eq(userCards.cardId, targetCard.id), eq(userCards.userId, userId)))
            if (!userCardRes.length) {
                appLogger(`User has no cards assigned, beginning assignment...`)
                let insertRes
                try {
                    insertRes = await db.insert(userCards).values({
                        cardId: targetCard.id,
                        userId,
                        cardNumber: data.cardNumber
                    }).returning()
                } catch (e) {
                    if (e instanceof Error && e.message.includes('FOREIGN KEY')) {
                        throw new HTTPException(400, {
                            message: 'This card already belongs to another user!'
                        })
                    }
                    throw e
                }
                if (!insertRes.length) {
                    throw new HTTPException(500, {
                        message: 'Could not assign card to user!'
                    })
                } else {
                    appLogger(`Card ${cardName} | ${data.cardNumber} assigned!`)
                }
            } else {
                appLogger(`Card ${cardName} | ${data.cardNumber} is already assigned!`)
            }

            const taggedTxns = await tagTransactions(undefined, data.transactions)
            const txnWithCardName = taggedTxns.map((t) => ({...t, accountName: cardName, cardId: targetCard.id}))
            taggedTransactions.push(...txnWithCardName)
        }
    }

    return c.json({
        taggedTransactions,
        statementData
    })
})

export type UiRouteType = typeof uiRoute