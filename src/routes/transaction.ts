import {Hono} from "hono";
import z from "zod";
import {zodValidator} from "../lib/middleware/zod-validator.ts";
import {pdfParser} from "../lib/pdf/pdf.ts";
import {db} from "../db/db.ts";
import {
    cards, tags,
    transactions as transactionsDb,
    transactionsInsertSchemaZ, type TransactionTagsInsertSchema,
    userCards, tagSelectSchemaZ, transactionTags as transactionTagsDb, transactionsUpdateSchemaZ,
    type TransactionsUpdateSchema
} from "../db/schema.ts";
import {eq, inArray} from "drizzle-orm";
import {appLogger} from "../index.ts";
import {HTTPException} from "hono/http-exception";
import type {StatementData} from "../lib/pdf/pdf.type.ts";
import {
    initClassifier,
    saveClassifier,
    tagTransactions,
    trainClassifier
} from "../lib/descriptionTagger/descriptionTagger.ts";
import {findUserOrThrow} from "./route.utils.ts";

export const transactionRoute = new Hono()

const FileUploadPayloadZ = z.object({
    // min 5kb, max 150kb
    userId: z.string(),
    file: z.file().mime(["application/pdf", "text/csv", "application/vnd.ms-excel"]).min(5 * 1000).max(150 * 1000)
})

transactionRoute.post("/fileUpload", zodValidator(FileUploadPayloadZ, "form"), async (c) => {
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

    const transactions = []
    if ('cards' in statementData) {
        for (const [cardName, data] of Object.entries(statementData.cards)) {
            const cardRes = await db.select().from(cards).where(inArray(cards.name, cardName.toLowerCase().split(' ')))
            if (!cardRes.length) {
                appLogger(`Card with name : ${cardName} not found in database, refining search...`)
                // TODO: try to refind card again
                // TODO: else try to insert card
                throw new HTTPException(404, {
                    message: 'Card does not exist, please add a card to continue'
                })
            }
            if (!cardRes[0]) {
                throw new HTTPException()
            }
            const userCardRes = await db.select().from(userCards).leftJoin(cards, eq(userCards.cardId, cards.id)).where(eq(cards.id, cardRes[0].id))
            if (!userCardRes.length) {
                appLogger(`User has no cards assigned, beginning assignment...`)
                await db.insert(userCards).values({cardId: cardRes[0].id, userId, cardNumber: data.cardNumber})
                appLogger(`Card ${cardName} | ${data.cardNumber} assigned!`)
            }

            const taggedTxns = await tagTransactions(undefined, data.transactions)
            transactions.push(...taggedTxns)
        }
    }

    return c.json({
        transactions
    })
})

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