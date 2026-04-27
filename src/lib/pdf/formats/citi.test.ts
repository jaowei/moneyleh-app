import { getFile, testATransaction, testUser } from "../../test.utils"
import { pdfParser } from "../pdf"
import { describe, test, expect } from "bun:test";

describe('pdf: Citibank statements', () => {
    test('card statement', async () => {
        const file = await getFile('./test-files/citiCard.pdf')
        const data = await pdfParser(file, testUser.id)
        if (data.type === 'card') {
            const cards = Object.values(data.cards)
            expect(cards.length).toBe(2)
            expect(cards[0]?.cardNumber.length).toBeGreaterThan(1)
            expect(cards[1]?.cardNumber.length).toBeGreaterThan(1)
            expect(cards[0]?.transactions.length).toBe(39)
            expect(cards[1]?.transactions.length).toBe(0)
            cards[0]?.transactions.forEach((t) => {
                testATransaction(t)
            })
            expect(data.creditLimit).toBe(30200)
            expect(data.statementDate).toBe('2026-04-19T00:00:00.000Z')
            expect(data.dueDate).toBe('2026-05-14T00:00:00.000Z')
        } else {
            throw new Error()
        }

    })
})