import {describe, expect, test} from "bun:test";
import {pdfParser} from "../pdf.ts";
import {testATransaction} from "../../test.utils.ts";

describe("pdf: dbs card format", () => {
    test("use statement with re issued card and fx transactions", async () => {
        const file = Bun.file('./test-files/dbsCard-fx-reissue.pdf')
        const buf = await file.arrayBuffer()
        const f = new File([buf], 'file')
        const data = await pdfParser(f)
        if ("cards" in data) {
            const cardsArr = Object.entries(data.cards)
            expect(cardsArr.length).toBe(2)
            cardsArr.forEach(([name, d], idx) => {
                if (idx === 0) {
                    expect(d.transactions.length).toBe(40)
                } else {
                    expect(d.transactions.length).toBe(20)
                }
                d.transactions.forEach(testATransaction)
            })

            const pointsArr = Object.entries(data.points)
            expect(pointsArr.length).toBe(2)
            pointsArr.forEach(([name, d], idx) => {
                expect(d.expiring).toBeNumber()
            })
        } else {
            throw Error()
        }
    })
})
