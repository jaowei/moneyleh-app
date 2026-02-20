import { describe, test, expect } from 'bun:test'
import { getFile, testATransaction, testUser } from '../../test.utils'
import { pdfParser } from '../pdf'

describe('pdf: scb formats', () => {
    test('parse scb card statement', async () => {
        const file = await getFile('./test-files/scbCard.pdf')
        const data = await pdfParser(file, testUser.id)
        if (data.type === 'card') {
            expect(Object.keys(data.cards).length).toBe(1)
            Object.values(data.cards).forEach((card) => {
                card.transactions.forEach(testATransaction)
                expect(card.transactions.length).toBe(9)
            })
        } else {
            throw new Error('Shoudl be card type')
        }
    })
})