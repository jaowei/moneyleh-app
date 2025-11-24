import {Hono} from "hono";
import z from "zod";
import {zodValidator} from "../lib/middleware/zod-validator.ts";
import {db} from "../db/db.ts";
import {
    tags as tagsDb,
    transactions as transactionsDb,
    transactionsInsertSchemaZ, type TransactionTagsInsertSchema,
    tagSelectSchemaZ, transactionTags as transactionTagsDb, transactionsUpdateSchemaZ,
    type TransactionsUpdateSchema, type TagInsertSchema,
    userCards, userAccounts
} from "../db/schema.ts";
import {and, eq, inArray, like} from "drizzle-orm";
import {appLogger} from "../index.ts";
import {HTTPException} from "hono/http-exception";
import {
    initClassifier,
    saveClassifier,
    trainClassifier
} from "../lib/descriptionTagger/descriptionTagger.ts";
import {findUserOrThrow} from "./route.utils.ts";
import {zValidator} from "@hono/zod-validator";
import {csvParserDirectUpload} from "../lib/csv/directUpload.ts";

const allowOnlyAccountOrCardIdErrMsg = 'An account id or card id is required, both cannot be empty and filled in the same transaction'

const transactionFromUIZ = transactionsInsertSchemaZ.extend({
    tags: z.array(tagSelectSchemaZ.partial().extend({
        id: z.number(),
        description: z.string().min(1)
    })).optional(),
    userId: z.string()
}).refine((data) => !(data.accountId && data.cardId) && !(!data.accountId && !data.cardId), {
    error: allowOnlyAccountOrCardIdErrMsg
})
const transactionsFromUIZ = z.array(transactionFromUIZ).min(1)
export type TransactionFromUI = z.infer<typeof transactionsFromUIZ>

const PostTransactionPayloadZ = z.object({
    transactions: transactionsFromUIZ
})
export type PostTransactionPayload = z.infer<typeof PostTransactionPayloadZ>

const postTransactionCsvPayloadZ = z.object({
    userId: z.string(),
    accountId: z.coerce.number<number>().optional(),
    cardId: z.coerce.number<number>().optional(),
    file: z.file().mime(["text/csv"]).max(1000 * 1000) // max 1mb
}).refine((data) => !(data.cardId && data.accountId) && !(!data.cardId && !data.accountId), {
    error: allowOnlyAccountOrCardIdErrMsg
})

const transactionsPatchPayloadZ = z.object({
    transactions: z.array(transactionsUpdateSchemaZ).min(1)
})

export const transactionRoute = new Hono().post('/', zValidator('json', PostTransactionPayloadZ), async (c) => {
    const {transactions} = c.req.valid('json')

    const classifier = await initClassifier()
    const transactionTags: TransactionTagsInsertSchema[] = []
    const failedTransactions: TransactionFromUI = []
    for (const t of transactions) {
        const {tags, ...rest} = t

        const findRes = await db.select().from(transactionsDb).where(and(eq(transactionsDb.description, t.description),
            eq(transactionsDb.amount, t.amount), eq(transactionsDb.transactionDate, t.transactionDate), eq(transactionsDb.userId, t.userId)))

        if (findRes.length) {
            appLogger(`Found ${findRes.length} similar transaction/s, skipping insert`)
            continue
        }

        const txnId = await db.insert(transactionsDb).values(rest).returning({id: transactionsDb.id})
        if (!txnId[0]) {
            appLogger(`WARN: Could not add transaction ${t.description}`)
            failedTransactions.push(t)
            continue
        }

        if (!tags) continue

        const tagIds = tags.map((tag) => tag.id)
        const queryRes = await db.select({
            id: tagsDb.id,
            description: tagsDb.description
        }).from(tagsDb).where(inArray(tagsDb.id, tagIds))

        for (const res of queryRes) {
            transactionTags.push(
                {
                    transactionId: txnId[0].id,
                    tagId: res.id
                }
            )
            trainClassifier(classifier, {description: t.description, tag: res.description})
        }

        if (queryRes.length !== tagIds.length) {
            appLogger(`WARN: Some tags do not exist! Inserted ${queryRes.length} out of ${tagIds.length} tags`)
        }
    }

    if (!transactionTags.length) {
        appLogger(`No tags to assign`)
    } else {
        const ids = await db.insert(transactionTagsDb).values(transactionTags).returning({id: transactionTagsDb.tagId})
        if (ids.length !== transactionTags.length) {
            throw new HTTPException(500, {
                message: `Did not tag all transactions properly: ${ids.length}/${transactionTags.length}`
            })
        }
    }

    await saveClassifier(classifier)

    return c.json({
        failed: failedTransactions
    })
})
    .post('/csv', zValidator('form', postTransactionCsvPayloadZ), async (c) => {
        const {userId, accountId, cardId, file} = c.req.valid('form')

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

        const classifier = await initClassifier()

        const failedT = []
        for (const t of parsedTransactions) {
            try {
                const tags = new Set<string>(t.tags)
                if (t.transactiontype) {
                    tags.add(t.transactiontype)
                }
                if (t.transactionmethod) {
                    tags.add(t.transactionmethod)
                }
                const insertedT = await db.insert(transactionsDb).values({
                    transactionDate: t.date,
                    currency: t.currency,
                    amount: t.amount,
                    description: t.description,
                    cardId,
                    accountId
                }).returning()
                if (!insertedT.length) {
                    appLogger(`Transaction was not inserted`)
                    failedT.push(t)
                    continue
                }
                if (!insertedT[0]) {
                    // just a type check, by then t will be available
                    continue
                }

                if (!tags.size) {
                    continue
                }

                const tagsToAdd: TagInsertSchema[] = []
                const tagsFound: TransactionTagsInsertSchema[] = []
                for (const tag of tags) {
                    const queryRes = await db.select().from(tagsDb).where(like(tagsDb.description, tag))
                    if (!queryRes.length) {
                        tagsToAdd.push({
                            description: tag
                        })
                    } else if (queryRes[0]) {
                        trainClassifier(classifier, {description: t.description, tag: queryRes[0].description})
                        tagsFound.push({
                            transactionId: insertedT[0].id,
                            tagId: queryRes[0].id
                        })
                    }
                }

                if (tagsToAdd.length) {
                    const insertedTags = await db.insert(tagsDb).values(tagsToAdd).returning()
                    for (const tag of insertedTags) {
                        trainClassifier(classifier, {description: t.description, tag: tag.description})
                        tagsFound.push({
                            transactionId: insertedT[0].id,
                            tagId: tag.id
                        })
                    }
                }

                await db.insert(transactionTagsDb).values(tagsFound)
            } catch (e) {
                appLogger(`Error processing transaction: ${JSON.stringify(e)}`)
                failedT.push(t)
            }
        }

        await saveClassifier(classifier)

        return c.json({
            failed: failedT
        })
    })
    .get('/:userId', async (c) => {
        const {userId} = c.req.param()

        await findUserOrThrow(userId)

        const queryRes = await db.select().from(transactionsDb).where(eq(transactionsDb.userId, userId))

        return c.json({
            transactions: queryRes
        })
    }).patch('/*', zodValidator(transactionsPatchPayloadZ), async (c) => {
        const {transactions} = c.req.valid('json')
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
                }).where(eq(transactionsDb.id, t.id)).returning({id: transactionsDb.id})
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