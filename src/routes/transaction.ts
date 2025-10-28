import {Hono} from "hono";
import z from "zod";
import {zodValidator} from "../lib/middleware/zod-validator.ts";
import {pdfParser} from "../lib/pdf/pdf.ts";
import {db} from "../db/db.ts";
import {cards, transactions, userCards} from "../db/schema.ts";
import {eq, inArray} from "drizzle-orm";
import {appLogger} from "../index.ts";
import {HTTPException} from "hono/http-exception";
import type {StatementData} from "../lib/pdf/pdf.type.ts";

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

        await db.insert(transactions).values(data.transactions)
        appLogger(`${data.transactions.length} transactions added!`)
    }

    return c.text('File successfully processed!')
})