import dayjs from "dayjs";
import { testUser } from "../../test.utils"
import { pdfParser } from "../pdf"
import { describe, test, expect } from "bun:test";

describe('pdf: Chocolate finance statement', () => {
    test('parse', async () => {
        const file = Bun.file('./test-files/chocolate.pdf')
        const buf = await file.arrayBuffer()
        const f = new File([buf], 'file')
        const data = await pdfParser(f, testUser.id)
        const dateObj = dayjs(data.statementDate)
        expect(dateObj.year()).toBe(2025)
        expect(dateObj.month()).toBe(8)
        expect(data.type).toBe('account')
        if (data.type === 'account') {
            const txns = data.accounts['chocolateManagedAccount']?.transactions
            expect(txns?.length).toBe(3)
            expect(txns?.[0]?.amount).toBe(-300)
            expect(txns?.[1]?.amount).toBe(300)
            expect(txns?.[2]?.amount).toBe(56.46)
            const hasNonSgd = txns?.some((t) => t.currency !== 'SGD')
            expect(hasNonSgd).toBe(false)
        }
    })
})