import {describe, expect, test} from 'bun:test'
import { getFile, testATransaction, testUser } from '../../test.utils'
import { pdfParser } from '../pdf'

describe('PDF format: GXS', () => {
    test('parse account statement', async () => {
        const file = await getFile('./test-files/gxsAccount.pdf')
        const data = await pdfParser(file, testUser.id)
        if (data.type === 'account') {
            expect(Object.keys(data.accounts).length).toBe(3)
            Object.entries(data.accounts).forEach(([name, data], idx) => {
                expect(name.length).toBeGreaterThan(1)
                expect(data.accountNumber.length).toBeGreaterThan(1)
                data.transactions.forEach((t) => {
                    testATransaction(t)
                })
                if (idx === 0) {
                    expect(data.transactions.length).toBe(4)
                }
                if (idx === 1) {
                    expect(data.transactions.length).toBe(33)
                }
                if (idx === 2) {
                    expect(data.transactions.length).toBe(32)
                }
            })
        } else {
            throw new Error()
        }
    })
})