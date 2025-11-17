import {Hono} from "hono";
import z from "zod";
import {zodValidator} from "../lib/middleware/zod-validator.ts";
import {db} from "../db/db.ts";
import {
    tags as tagsDb,
    transactions as transactionsDb,
    transactionsInsertSchemaZ, type TransactionTagsInsertSchema,
    tagSelectSchemaZ, transactionTags as transactionTagsDb, transactionsUpdateSchemaZ,
    type TransactionsUpdateSchema
} from "../db/schema.ts";
import {and, eq, inArray} from "drizzle-orm";
import {appLogger} from "../index.ts";
import {HTTPException} from "hono/http-exception";
import {
    initClassifier,
    saveClassifier,
    trainClassifier
} from "../lib/descriptionTagger/descriptionTagger.ts";
import {findUserOrThrow} from "./route.utils.ts";
import {zValidator} from "@hono/zod-validator";


const transactionFromUIZ = transactionsInsertSchemaZ.extend({
    tags: z.array(tagSelectSchemaZ.partial().extend({
        id: z.number(),
        description: z.string().min(1)
    })).optional(),
    userId: z.string()
}).refine((data) => !(data.accountId && data.cardId) && !(!data.accountId && !data.cardId), {
    error: 'An account id or card id is required, both cannot be empty and filled in the same transaction'
})
const transactionsFromUIZ = z.array(transactionFromUIZ).min(1)
export type TransactionFromUI = z.infer<typeof transactionsFromUIZ>

const PostTransactionPayloadZ = z.object({
    transactions: transactionsFromUIZ
})
export type PostTransactionPayload = z.infer<typeof PostTransactionPayloadZ>

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

transactionRoute.get('/:userId', async (c) => {
    const {userId} = c.req.param()

    await findUserOrThrow(userId)

    const queryRes = await db.select().from(transactionsDb).where(eq(transactionsDb.userId, userId))

    return c.json({
        transactions: queryRes
    })
})

const transactionsPatchPayloadZ = z.object({
    transactions: z.array(transactionsUpdateSchemaZ).min(1)
})

transactionRoute.patch('/*', zodValidator(transactionsPatchPayloadZ), async (c) => {
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