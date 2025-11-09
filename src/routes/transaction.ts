import {Hono} from "hono";
import z from "zod";
import {zodValidator} from "../lib/middleware/zod-validator.ts";
import {db} from "../db/db.ts";
import {
    tags,
    transactions as transactionsDb,
    transactionsInsertSchemaZ, type TransactionTagsInsertSchema,
    tagSelectSchemaZ, transactionTags as transactionTagsDb, transactionsUpdateSchemaZ,
    type TransactionsUpdateSchema
} from "../db/schema.ts";
import {eq} from "drizzle-orm";
import {appLogger} from "../index.ts";
import {HTTPException} from "hono/http-exception";
import {
    initClassifier,
    saveClassifier,
    trainClassifier
} from "../lib/descriptionTagger/descriptionTagger.ts";
import {findUserOrThrow} from "./route.utils.ts";

export const transactionRoute = new Hono()

const transactionFromUIZ = z.array(transactionsInsertSchemaZ.extend({
    tag: tagSelectSchemaZ.extend({
        updated_at: z.string().optional(),
        created_at: z.string().optional(),
        deleted_at: z.string().optional()
    }).optional()
})).min(1)
export type TransactionFromUI = z.infer<typeof transactionFromUIZ>

const PostTransactionPayloadZ = z.object({
    transactions: transactionFromUIZ
})
export type PostTransactionPayload = z.infer<typeof PostTransactionPayloadZ>

transactionRoute.post('/*', zodValidator(PostTransactionPayloadZ), async (c) => {
    const {transactions} = c.req.valid('json')

    const classifier = await initClassifier()
    const transactionTags: TransactionTagsInsertSchema[] = []
    const failedTransactions: TransactionFromUI = []
    for (const t of transactions) {
        const {tag, ...rest} = t
        const txnId = await db.insert(transactionsDb).values(rest).returning({id: transactionsDb.id})
        if (!txnId[0]) {
            appLogger(`WARN: Could not add transaction ${t.description}`)
            failedTransactions.push(t)
            continue
        }
        if (tag) {
            const queryRes = await db.select({
                id: tags.id,
                description: tags.description
            }).from(tags).where(eq(tags.id, tag.id))
            if (queryRes.length) {
                transactionTags.push(
                    {
                        transactionId: txnId[0].id,
                        tagId: tag.id
                    }
                )
                trainClassifier(classifier, {description: t.description, tag: tag.description})
            } else {
                appLogger(`WARN: Could not find tag: ${tag.id} | ${tag.description}`)
            }
        }
    }

    const ids = await db.insert(transactionTagsDb).values(transactionTags).returning({id: transactionTagsDb.tagId})

    if (ids.length !== transactionTags.length) {
        throw new HTTPException(500, {
            message: `Did not tag all transactions properly: ${ids.length}/${transactionTags.length}`
        })
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