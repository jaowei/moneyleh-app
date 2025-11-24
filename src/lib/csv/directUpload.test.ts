import {describe, expect, test} from "bun:test";
import {csvParserDirectUpload} from "./directUpload.ts";

describe('csv: migration via csv file', () => {
    test('parse', async () => {
        const file = Bun.file('./test-files/migrationTest.csv')
        const buf = await file.arrayBuffer()
        const f = new File([buf], 'file')
        const txns = await csvParserDirectUpload(f)
        expect(txns.length).toBe(400)
    })
})