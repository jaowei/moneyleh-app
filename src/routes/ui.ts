import {Hono} from "hono";
import z from "zod";
import {db} from "../db/db.ts";
import {
    accounts,
    cards, companies, userAccountInsertSchemaZ,
    userAccounts,
    userCardInsertSchemaZ,
    userCards,
    userCompanies
} from "../db/schema.ts";
import {and, eq, inArray, like} from "drizzle-orm";
import {appLogger} from "../index.ts";
import {HTTPException} from "hono/http-exception";
import {findUserOrThrow} from "./route.utils.ts";
import type {StatementData} from "../lib/pdf/pdf.type.ts";
import {pdfParser} from "../lib/pdf/pdf.ts";
import {type TaggedTransaction, tagTransactions} from "../lib/descriptionTagger/descriptionTagger.ts";
import {zodValidator} from "../lib/middleware/zod-validator.ts";

const userAssignmentsZ = z.object({
    accountData: z.array(userAccountInsertSchemaZ.extend({
        accountId: z.number()
    })).optional(),
    cardData: z.array(userCardInsertSchemaZ.extend({
        cardId: z.number()
    })).optional(),
})

const FileUploadPayloadZ = z.object({
    // min 5kb, max 150kb
    userId: z.string(),
    file: z.file().mime(["application/pdf", "text/csv", "application/vnd.ms-excel"]).min(5 * 1000).max(200 * 1000)
})

export const uiRoute = new Hono().post("/assignTo/:userId", zodValidator('json', userAssignmentsZ),
    async (c) => {
        const userId = c.req.param("userId")
        const {accountData, cardData} = c.req.valid('json')
        if (!accountData?.length && !cardData?.length) {
            c.status(400)
            return c.text('No ids to assign!')
        }

        await findUserOrThrow(userId)

        // insert into the associative tables
        try {
            const companiesSet = new Set<number>()
            if (accountData) {
                appLogger(`${accountData.length} accounts provided, inserting...`)
                await db.insert(userAccounts).values(accountData.map((acc) => ({
                    ...acc,
                    userId,
                })))
                appLogger(`${accountData.length} accounts inserted, getting companies...`)
                const accountIds = accountData.map((a) => a.accountId)
                const companiesForAccounts = await db.selectDistinct({companyId: accounts.companyId}).from(accounts).where(inArray(accounts.id, accountIds))
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
                        cardLabel: d.cardLabel
                    }
                )))
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
            return c.text(`Successfully added ${accountData?.length} accounts, ${cardData?.length} cards, and ${companiesSet.size} companies to user`)
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
}).post("/fileUpload", zodValidator('form', FileUploadPayloadZ), async (c) => {
    const {file, userId} = c.req.valid('form')

    let statementData: StatementData | undefined = undefined
    // TODO: How to prevent duplicate statement upload
    switch (file.type) {
        case 'application/pdf':
            statementData = await pdfParser(file, userId)
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
    switch (statementData.type) {
        case "card":
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
                    appLogger(`Card ${cardName} not assigned to user, beginning assignment...`)
                    let insertRes
                    try {
                        insertRes = await db.insert(userCards).values({
                            cardId: targetCard.id,
                            userId,
                            cardLabel: data.cardNumber
                        }).returning()
                    } catch (e) {
                        if (e instanceof Error && e.message.includes('FOREIGN KEY')) {
                            throw new HTTPException(400, {
                                message: 'This card already belongs to the user!'
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
            break;
        case "account":
            for (const [accountName, data] of Object.entries(statementData.accounts)) {
                let targetAccount
                const accountRes = await db.select().from(accounts).where(like(accounts.name, accountName.toLowerCase().replaceAll(' ', '_')))
                if (!accountRes.length) {
                    appLogger(`Account with name : ${accountName} not found in database, refining search...`)
                    // TODO: try to refind account again
                    // TODO: else try to insert account
                    throw new HTTPException(404, {
                        message: 'Account does not exist, please add an account to continue'
                    })
                } else {
                    targetAccount = accountRes[0]
                }

                if (!targetAccount) {
                    throw new HTTPException()
                }
                const userAccountRes = await db.select().from(userAccounts).where(and(eq(userAccounts.accountId, targetAccount.id), eq(userAccounts.userId, userId)))
                if (!userAccountRes.length) {
                    appLogger(`Account ${accountName} not assigned to user, beginning assignment...`)
                    let insertRes
                    try {
                        insertRes = await db.insert(userAccounts).values({
                            accountId: targetAccount.id,
                            userId,
                            accountLabel: data.accountNumber
                        }).returning()
                    } catch (e) {
                        if (e instanceof Error && e.message.includes('FOREIGN KEY')) {
                            throw new HTTPException(400, {
                                message: 'This  already belongs to the user!'
                            })
                        }
                        throw e
                    }
                    if (!insertRes.length) {
                        throw new HTTPException(500, {
                            message: 'Could not assign account to user!'
                        })
                    } else {
                        appLogger(`Card ${accountName} | ${data.accountNumber} assigned!`)
                    }
                } else {
                    appLogger(`Card ${accountName} | ${data.accountNumber} is already assigned!`)
                }

                const taggedTxns = await tagTransactions(undefined, data.transactions)
                const txnWithAccountName = taggedTxns.map((t) => ({...t, accountName, accountId: targetAccount.id}))
                taggedTransactions.push(...txnWithAccountName)
            }
            break;
        case "cpf":
            appLogger('NOT IMPLEMENTED')
            break;
        default:
            appLogger('NOT IMPLEMENTED')
            break;
    }

    return c.json({
        taggedTransactions,
        statementData
    })
}).get('/availableInventory/:userId', async (c) => {
    const {userId} = c.req.param()

    const allCardRows = await db.select().from(companies)
        .leftJoin(cards, eq(companies.id, cards.companyId))
        .leftJoin(userCards, and(eq(cards.id, userCards.cardId), eq(userCards.userId, userId)))

    const userCardRows = allCardRows.filter((row) => row.user_cards)

    const allAccountRows = await db.select().from(companies)
        .leftJoin(accounts, eq(companies.id, accounts.companyId))
        .leftJoin(userAccounts, and(eq(userAccounts.accountId, accounts.id), eq(userAccounts.userId, userId)))

    const userAccountRows = allAccountRows.filter((row) => row.user_accounts)

    return c.json({
        allAccounts: allAccountRows,
        allCards: allCardRows,
        userCards: userCardRows,
        userAccounts: userAccountRows
    })
})

export type UiRouteType = typeof uiRoute