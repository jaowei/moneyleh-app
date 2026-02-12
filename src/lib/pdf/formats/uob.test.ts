import { describe, test, expect } from 'bun:test'
import { getFile, testATransaction, testUser } from '../../test.utils'
import { pdfParser } from '../pdf'

describe('pdf: uob formats', () => {
    test('parses uob card statement', async () => {
        const file = await getFile('./test-files/uobCard.pdf')
        const data = await pdfParser(file, testUser.id)
        if (data.type === 'card') {
            Object.values(data.cards).forEach((d, idx) => {
                if (idx === 0) {
                    d.transactions.length = 10
                    d.total = -289.01
                    d.transactions.forEach(testATransaction)
                } else {
                    d.transactions.length = 14
                    d.total = -345.9
                    d.transactions.forEach(testATransaction)
                }
            })
        } else {
            throw Error('Should be a card statement')
        }
    })

    test('parses uob account statement', async () => {
        const file = await getFile('./test-files/uobAccountStatement.pdf')
        const data = await pdfParser(file, testUser.id)
        if (data.type === 'account') {
            expect(Object.keys(data.accounts).length).toBe(1)
            Object.values(data.accounts).forEach((d) => {
                expect(d.transactions.length).toBe(12)
                d.transactions.forEach(testATransaction)
            })

        } else {
            throw Error('Should be a account statement')
        }
    })
})