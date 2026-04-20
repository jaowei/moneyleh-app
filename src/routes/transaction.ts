import { Hono } from "hono";
import z from "zod";
import { zodValidator } from "../lib/middleware/zod-validator.ts";
import { db } from "../db/db.ts";
import {
    tags as tagsDb,
    transactions as transactionsDb,
    transactionsInsertSchemaZ, type TransactionTagsInsertSchema,
    tagSelectSchemaZ, transactionTags as transactionTagsDb, transactionsUpdateSchemaZ,
    type TransactionsUpdateSchema,
    userCards, userAccounts, type TagSelectSchema, accounts, cards,
    statementOwnerships,
    statements,
    type TransactionsSelectSchema,
} from "../db/schema.ts";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { appLogger } from "../index.ts";
import { HTTPException } from "hono/http-exception";
import { findUserOrThrow } from "./route.utils.ts";
import { csvParserDirectUpload } from "../lib/csv/directUpload.ts";
import { paginationZ, refineAccountOrCardId } from "./route.types.ts";
import type { DocumentToAdd } from "../lib/descriptionTagger/base-classifier.ts";
import { runTrainer } from "./transaction.utils.ts";

const allowOnlyAccountOrCardIdErrMsg = 'An account id or card id is required, both cannot be empty and filled in the same transaction'

const transactionFromUIZ = transactionsInsertSchemaZ.extend({
    tags: z.array(tagSelectSchemaZ.partial().extend({
        id: z.number(),
        description: z.string().min(1)
    })).optional(),
    userId: z.string()
}).refine((data) => refineAccountOrCardId(data), { error: allowOnlyAccountOrCardIdErrMsg })
const transactionsFromUIZ = z.array(transactionFromUIZ).min(1)
export type TransactionFromUI = z.infer<typeof transactionsFromUIZ>

const cardInfoPayloadZ = z.object({
    cardId: z.coerce.number(),
    cardName: z.string()
}).optional()
type CardInfoPayload = z.infer<typeof cardInfoPayloadZ>
const accountInfoPayloadZ = z.object({
    accountId: z.coerce.number(),
    accountName: z.string()
}).optional()
type AccountInfoPayload = z.infer<typeof accountInfoPayloadZ>
const PostTransactionPayloadZ = z.object({
    transactions: transactionsFromUIZ,
    statementInfo: z.object({
        statementDate: z.string()
    }),
    cardInfo: cardInfoPayloadZ,
    accountInfo: accountInfoPayloadZ
})
export type PostTransactionPayload = z.infer<typeof PostTransactionPayloadZ>

const postTransactionCsvPayloadZ = z.object({
    userId: z.string(),
    accountId: z.coerce.number().optional(),
    cardId: z.coerce.number().optional(),
    file: z.file().mime(["text/csv"]).max(1000 * 1000) // max 1mb
}).refine((data) => refineAccountOrCardId(data), { error: allowOnlyAccountOrCardIdErrMsg })

const transactionsPatchPayloadZ = z.object({
    transactions: z.array(transactionsUpdateSchemaZ).min(1)
})

const getUserTransactionsQueryZ = z.discriminatedUnion(
    "type",
    [
        z.object({ type: z.literal("account"), accountId: z.coerce.number(), ...paginationZ.shape }),
        z.object({ type: z.literal("card"), cardId: z.coerce.number(), ...paginationZ.shape }),
    ]
)

export const transactionRoute = new Hono()
    .post('/', zodValidator('json', PostTransactionPayloadZ), async (c) => {
        const { transactions, statementInfo, cardInfo, accountInfo } = c.req.valid('json')

        const addStatementOrThrow = async (statementDate: string, cardInfo: CardInfoPayload, accountInfo: AccountInfoPayload) => {
            let queryFilter
            let logMsg
            if (cardInfo) {
                queryFilter = eq(statementOwnerships.cardId, cardInfo.cardId)
                logMsg = `Card: ${cardInfo.cardName}`
            } else if (accountInfo) {
                queryFilter = eq(statementOwnerships.accountId, accountInfo.accountId)
                logMsg = `Account: ${accountInfo.accountName}`
            } else {
                throw new HTTPException(400, { message: 'Error checking statement info' })
            }

            const existingStatementQuery = await db.select().from(statements)
                .leftJoin(statementOwnerships, eq(statements.id, statementOwnerships.statementId))
                .where(and(
                    eq(statements.statementDate, statementDate),
                    queryFilter
                ))

            if (existingStatementQuery.length > 0) {
                throw new HTTPException(400, { message: `${logMsg} | statement date: ${statementDate} already added` })
            }
            return logMsg
        }

        const statementLog = await addStatementOrThrow(statementInfo.statementDate, cardInfo, accountInfo)

        let shouldTrain = false;
        const documentsToAdd: DocumentToAdd[] = []
        const insertedTransactionIds: number[] = []
        const userId = transactions[0]?.userId || '' // user id always exists
        try {
            db.transaction((tx) => {
                appLogger('Checking statement details...')
                const insertedStatement = tx.insert(statements).values({
                    statementDate: statementInfo.statementDate,
                    userId
                }).onConflictDoNothing().returning().all()
                if (!insertedStatement[0]) {
                    tx.rollback()
                    throw new Error(`Error persisting statement for user ${userId}, ${statementLog}`)
                }
                const insertedOwnership = tx.insert(statementOwnerships).values({
                    statementId: insertedStatement[0].id,
                    ...(cardInfo && { cardId: cardInfo.cardId }),
                    ...(accountInfo && { accountId: accountInfo.accountId }),
                }).returning().all()

                if (!insertedOwnership[0]) {
                    tx.rollback()
                    throw new Error(`Error persisting statement ownership for user ${userId}, ${statementLog}`)
                }
                appLogger(`Inserted statement and statment ownership for user ${userId}, ${statementLog}`)

                appLogger('Processing transactions...')
                for (const t of transactions) {
                    const { tags, ...rest } = t

                    const findRes = tx.select().from(transactionsDb).where(and(
                        eq(transactionsDb.description, t.description),
                        eq(transactionsDb.amount, t.amount),
                        eq(transactionsDb.transactionDate, t.transactionDate),
                        eq(transactionsDb.userId, t.userId))
                    ).all()

                    if (findRes.length) {
                        appLogger(`Found ${findRes.length} similar transaction/s, skipping insert`)
                        throw new Error('Found similar transaction')
                    }

                    const txnId = tx.insert(transactionsDb).values(rest).returning({ id: transactionsDb.id }).all()
                    const insertedTxn = txnId[0]
                    if (!insertedTxn) {
                        appLogger(`WARN: Could not add transaction ${t.description}`)
                        throw new Error(`Could not add transaction ${t.description}`)
                    }

                    if (!tags || !tags.length) continue

                    const tagIds = tags.map((tag) => tag.id)
                    insertedTransactionIds.push(...txnId.map((txn) => txn.id))
                    const queryRes = tx.select({
                        id: tagsDb.id,
                        description: tagsDb.description
                    }).from(tagsDb).where(inArray(tagsDb.id, tagIds)).all()

                    if (queryRes.length !== tagIds.length) {
                        appLogger(`WARN: Some tags do not exist! Inserted ${queryRes.length} out of ${tagIds.length} tags`)
                        appLogger(`  tagIds inserted: ${JSON.stringify(queryRes)}`)
                        appLogger(`  tagIds given: ${JSON.stringify(tagIds)}`)
                        throw new Error('Tag does not exist!')
                    } else {
                        const transactionTagsToInsert = queryRes.map((foundTag) => {
                            documentsToAdd.push({
                                description: t.description, tag: foundTag.description,
                                transactionId: insertedTxn.id
                            })
                            return {
                                transactionId: insertedTxn.id,
                                tagId: foundTag.id
                            }
                        })
                        const ids = tx.insert(transactionTagsDb).values(transactionTagsToInsert).returning({ id: transactionTagsDb.tagId }).all()
                        if (ids.length !== queryRes.length) {
                            appLogger(`WARN: Not all tags inserted`)
                            tx.rollback()
                        } else {
                            appLogger(`Inserted ${ids.length} tags`)
                            shouldTrain = true
                        }
                    }
                }
            })
        } catch (e) {
            const message = e instanceof Error ? e.message : JSON.stringify(e)
            throw new HTTPException(400, {
                message
            })
        }

        if (shouldTrain && documentsToAdd.length) {
            runTrainer(documentsToAdd, insertedTransactionIds, {
                userId,
                transactionsInserted: insertedTransactionIds.length
            })
        }

        return c.text('All inserted', 201)
    })
    .post('/csv', zodValidator('form', postTransactionCsvPayloadZ), async (c) => {
        const { userId, accountId, cardId, file } = c.req.valid('form')

        await findUserOrThrow(userId)

        const notAssignedError = new HTTPException(400, {
            message: `The card/account has not been assigned to user!`
        })
        if (cardId) {
            const findCard = await db.select().from(userCards).where(
                and(
                    eq(userCards.userId, userId),
                    eq(userCards.cardId, cardId)
                ))
            if (!findCard.length) {
                throw notAssignedError
            }
        } else if (accountId) {
            const findAccount = await db.select().from(userAccounts).where(
                and(
                    eq(userAccounts.userId, userId),
                    eq(userAccounts.accountId, accountId)
                ))
            if (!findAccount.length) {
                throw notAssignedError
            }
        }

        const parsedTransactions = await csvParserDirectUpload(file)

        const documentsToAdd: DocumentToAdd[] = []

        const insertedTransactionIds: number[] = []

        try {
            db.transaction((tx) => {
                const txnMap: Record<string, Set<string>> = {}
                const txnToInsert = []
                let allTags = new Set<string>()

                for (const t of parsedTransactions) {
                    const tags = new Set<string>(t.tags)

                    if (t.transactiontype) {
                        tags.add(t.transactiontype)
                    }

                    if (t.transactionmethod) {
                        tags.add(t.transactionmethod)
                    }
                    const key = `${t.date}${t.description}${t.amount}`
                    txnToInsert.push(
                        {
                            transactionDate: t.date,
                            currency: t.currency,
                            amount: t.amount,
                            description: t.description,
                            cardId,
                            accountId,
                            userId
                        }
                    )
                    txnMap[key] = tags
                    allTags = tags.union(allTags)
                }

                const insertedT = tx.insert(transactionsDb).values(txnToInsert).returning().all()
                if (!insertedT.length) {
                    throw new Error('No transactions inserted')
                }

                if (insertedT.length !== txnToInsert.length) {
                    appLogger(`Transactions inserted ${insertedT.length} out of ${txnToInsert.length}`)
                    throw new Error(' Not all transactions inserted')
                }
                insertedTransactionIds.push(...insertedT.map((txn) => txn.id))

                const existingTagsQuery = tx.select().from(tagsDb).where(inArray(tagsDb.description, [...allTags])).all()
                const existingTagSet = new Set<string>(existingTagsQuery.map((existing) => existing.description))
                const tagsToAddSet = allTags.difference(existingTagSet)
                const tagsToAdd = [...tagsToAddSet].map((add) => ({
                    description: add
                }))
                let insertedTags: TagSelectSchema[] = []
                if (tagsToAdd.length) {
                    insertedTags = tx.insert(tagsDb).values(tagsToAdd).returning().all()
                    if (!insertedTags.length) {
                        throw new Error('No tags added')
                    }
                    if (insertedTags.length !== tagsToAdd.length) {
                        throw new Error('Not all tags inserted')
                    }
                }

                const tagsFound: TransactionTagsInsertSchema[] = []
                for (const inserted of insertedT) {
                    const matcherKey = `${inserted.transactionDate}${inserted.description}${inserted.amount}`
                    if (txnMap[matcherKey]) {
                        for (const tag of txnMap[matcherKey]) {
                            const foundTag = existingTagsQuery.concat(insertedTags).find((tagDb) => tagDb.description === tag)
                            if (!foundTag) {
                                throw new Error(`Cannot find tag ${tag} in db`)
                            }
                            documentsToAdd.push({
                                description: inserted.description,
                                tag,
                                transactionId: inserted.id
                            })
                            tagsFound.push({
                                transactionId: inserted.id,
                                tagId: foundTag.id
                            })
                        }
                    }
                }

                const insertRes = tx.insert(transactionTagsDb).values(tagsFound).returning().all()

                if (insertRes.length !== tagsFound.length) {
                    throw new Error(`Supposed to add ${tagsFound.length} tagged transactions, only added ${insertRes.length}`)
                }
            })
        } catch (e) {
            const message = e instanceof Error ? e.message : JSON.stringify(e)
            console.log(e)
            throw new HTTPException(400, {
                message
            })
        }

        runTrainer(documentsToAdd, insertedTransactionIds, {
            userId,
            transactionsInserted: insertedTransactionIds.length
        })

        return c.text('All inserted', 201)
    })
    .get('/:userId', zodValidator('query', getUserTransactionsQueryZ), async (c) => {
        const { userId } = c.req.param()
        const { limit, offset, ...targetId } = c.req.valid('query')

        const isAccount = targetId.type === 'account'
        const usersFilter = eq(transactionsDb.userId, userId)
        const transactionFilter = isAccount ? and(usersFilter, eq(transactionsDb.accountId, targetId.accountId))
            : and(usersFilter, eq(transactionsDb.cardId, targetId.cardId))

        await findUserOrThrow(userId)

        let displayName = ''
        if (isAccount) {
            const accountQuery = await db.select().from(accounts).where(eq(accounts.id, targetId.accountId))
            if (accountQuery[0]) {
                displayName = accountQuery[0].name
            }
        } else {
            const cardQuery = await db.select().from(cards).where(eq(cards.id, targetId.cardId))
            if (cardQuery[0]) {
                displayName = `${cardQuery[0].name} - ${cardQuery[0].cardNetwork}`
            }
        }

        const queryRes = await db.select().from(transactionsDb).where(transactionFilter)
            .leftJoin(transactionTagsDb, eq(transactionTagsDb.transactionId, transactionsDb.id))
            .leftJoin(tagsDb, eq(transactionTagsDb.tagId, tagsDb.id))
            .leftJoin(accounts, eq(accounts.id, transactionsDb.accountId))
            .leftJoin(cards, eq(cards.id, transactionsDb.cardId))
            .orderBy(desc(transactionsDb.transactionDate))
            .limit(limit)
            .offset(offset)

        const processedTransactions = queryRes.map((row) => {
            const txn = row.transactions
            const tag = row.tags
            return {
                ...txn,
                tags: tag ? [tag] : [],
                accountName: row.accounts ? row.accounts.name : undefined,
                cardName: row.cards ? `${row.cards.name} ${row.cards.cardNetwork}` : undefined
            }
        })

        const uniqueTransactionsMap = new Map<number,
            TransactionsSelectSchema & { tags: TagSelectSchema[]; accountName?: string; cardName?: string }
        >()
        processedTransactions.forEach((t) => {
            const transaction = uniqueTransactionsMap.get(t.id)
            if (transaction) {
                transaction.tags.push(...t.tags)
            } else {
                uniqueTransactionsMap.set(t.id, t)
            }
        })
        const transactionsToReturn = Array.from(uniqueTransactionsMap.values())

        const totalNumTxnsQuery = await db.select({ value: count(transactionsDb.id) }).from(transactionsDb)
            .where(transactionFilter)

        let transactionCount = 0
        if (totalNumTxnsQuery[0]) {
            transactionCount = totalNumTxnsQuery[0].value
        }

        const sumSql = sql<number>`sum(
        ${transactionsDb.amount}
        )`
        const totalValueQuery = await db.select({
            currency: transactionsDb.currency,
            sum: sumSql
        }).from(transactionsDb)
            .where(transactionFilter)
            .groupBy(transactionsDb.currency)

        const valueByCurrency: Record<string, number> = {}
        for (const queryRes of totalValueQuery) {
            if (!valueByCurrency[queryRes.currency] && queryRes.sum) {
                valueByCurrency[queryRes.currency] = queryRes.sum
            } else {
                valueByCurrency[queryRes.currency] = 0
            }
        }

        const yearMonthSql = sql<string>`strftime
        ('%Y-%m',
        ${transactionsDb.transactionDate}
        )`
        const movementByYearMonth = await db.select({
            currency: transactionsDb.currency,
            yearMonth: yearMonthSql,
            sum: sumSql
        })
            .from(transactionsDb).where(transactionFilter)
            .groupBy(yearMonthSql, transactionsDb.currency).orderBy(yearMonthSql)

        type ChartValuesLabels = { labels: string[]; movementValues: number[]; balanceValues: number[] }
        const chartData: Record<string, ChartValuesLabels> = {}

        for (const movement of movementByYearMonth) {
            const { yearMonth, sum } = movement
            if (!chartData[movement.currency]) {
                chartData[movement.currency] = { labels: [yearMonth], movementValues: [sum], balanceValues: [] }
            } else {
                chartData[movement.currency]?.movementValues.push(sum)
                chartData[movement.currency]?.labels.push(yearMonth)
            }
        }

        Object.entries(chartData).forEach(([currency, values]) => {
            const valueByYearMonth = values.movementValues.reduce((prev, currentSum) => {
                const prevSum = prev.at(-1)
                if (prevSum === undefined) {
                    prev.push(currentSum)
                } else {
                    prev.push(currentSum + prevSum)
                }
                return prev
            }, [] as number[])
            chartData[currency]?.balanceValues.push(...valueByYearMonth)
        })

        return c.json({
            displayName,
            transactions: transactionsToReturn,
            transactionCount,
            valueByCurrency,
            chartData
        })
    })
    .patch('/*', zodValidator('json', transactionsPatchPayloadZ), async (c) => {
        const { transactions } = c.req.valid('json')
        const failedUpdates: TransactionsUpdateSchema[] = []
        for (const t of transactions) {
            if (!t.id) {
                failedUpdates.push(t)
                continue
            }
            try {
                const updateRes = await db.update(transactionsDb).set({
                    ...t,
                    updated_at: new Date().toISOString()
                }).where(eq(transactionsDb.id, t.id)).returning({ id: transactionsDb.id })
                if (!updateRes.length) {
                    failedUpdates.push(t)
                }
            } catch (e) {
                failedUpdates.push(t)
            }
        }
        return c.json({
            failed: failedUpdates
        })
    })