import {Hono} from "hono";
import z from "zod";
import {zodValidator} from "../lib/middleware/zod-validator.ts";
import {pdfParser} from "../lib/pdf/pdf.ts";
import {db} from "../db/db.ts";
import {cards, transactions, userCards} from "../db/schema.ts";
import {eq, inArray} from "drizzle-orm";
import {appLogger} from "../index.ts";
import {HTTPException} from "hono/http-exception";

export const transactionRoute = new Hono()

const FileUploadPayloadZ = z.object({
    // min 5kb, max 150kb
    userId: z.string(),
    file: z.file().mime(["application/pdf", "text/csv", "application/vnd.ms-excel"]).min(5 * 1000).max(150 * 1000)
})

transactionRoute.post("/fileUpload", zodValidator(FileUploadPayloadZ, "form"), async (c) => {
    const {file, userId} = c.req.valid('form')

    // TODO: How to prevent duplicate statement upload
    switch (file.type) {
        case 'application/pdf':
            const statementData = await pdfParser(file)
            for (const [cardName, data] of Object.entries(statementData.cards)) {
                const cardRes = await db.select().from(cards).where(inArray(cards.name, cardName.toLowerCase().split(' ')))
                if (!cardRes.length) {
                    appLogger(`Card with name : ${cardName} not found in database, refining search...`)
                    // TODO: try to refind card again

                    // TODO: else try to insert card
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
            }
            break;
        case "application/vnd.ms-excel":
            console.log('I am xls')
            break;
        default:
            console.log('I am csv')
    }

    return c.text('File successfully processed!')
})