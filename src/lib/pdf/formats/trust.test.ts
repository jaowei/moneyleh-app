import { describe, test, expect } from 'bun:test'
import { getFile, testATransaction, testUser } from '../../test.utils'
import { pdfParser } from '../pdf'

describe('pdf: trust bank formats', () => {
    test('parse trust card statement: offset statement date', async () => {
        const file = await getFile('./test-files/trustCard.pdf')
        const data = await pdfParser(file, testUser.id)
        if (data.type === 'card') {
            expect(Object.keys(data.cards).length).toBe(1)
            Object.values(data.cards).forEach((cardData) => {
                expect(cardData.transactions.length).toBe(5)
                cardData.transactions.forEach(testATransaction)
            })

        } else {
            throw new Error('Should be card type data')
        }
    })
    test('parse trust card statement: straight statement date', async () => {
        const file = await getFile('./test-files/trustCard-straight.pdf')
        const data = await pdfParser(file, testUser.id)
        if (data.type === 'card') {
            expect(Object.keys(data.cards).length).toBe(1)
            Object.values(data.cards).forEach((cardData) => {
                expect(cardData.transactions.length).toBe(3)
                cardData.transactions.forEach(testATransaction)
                console.log(cardData.transactions)
            })

        } else {
            throw new Error('Should be card type data')
        }
    })
})