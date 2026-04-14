import { describe, expect, test } from "bun:test";
import { csvParserDirectUpload } from "./directUpload.ts";

describe('csv: migration via csv file', () => {
    test('parse', async () => {
        const file = Bun.file('./test-files/migrationTest.csv')
        const buf = await file.arrayBuffer()
        const f = new File([buf], 'file')
        const txns = await csvParserDirectUpload(f)
        expect(txns.length).toBe(65)
    })
    test('parse zero value', async () => {
        const csvHeaders = 'Date,tags,Currency, Amount ,description,TransactionMethod,TransactionType\n'
        const testString = csvHeaders + `2021-01-01,Balance,SGD," $-",Beginning balance 2021,,\n2021-01-01,Balance,SGD," $-123",Beginning balance 2021,,`
        const buf = Buffer.from(testString)
        const f = new File([buf], 'file')
        const txns = await csvParserDirectUpload(f)
        expect(txns.length).toBe(2)
        expect(txns[0]?.amount).toBe(0)
        expect(txns[1]?.amount).toBe(-123)
    })
})