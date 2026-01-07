import {describe, expect, test} from "bun:test";
import {pdfParser} from "../pdf.ts";
import {testATransaction, testUser} from "../../test.utils.ts";

describe("pdf: dbs formats", () => {
    describe('dbs card', () => {
        test("use statement with re issued card and fx transactions", async () => {
            const file = Bun.file('./test-files/dbsCard-fx-reissue.pdf')
            const buf = await file.arrayBuffer()
            const f = new File([buf], 'file')
            const data = await pdfParser(f, testUser.id)
            if ("cards" in data) {
                const cardsArr = Object.entries(data.cards)
                expect(cardsArr.length).toBe(2)
                cardsArr.forEach(([name, d], idx) => {
                    if (idx === 0) {
                        expect(d.transactions).toBeArrayOfSize(40)
                    } else {
                        expect(d.transactions).toBeArrayOfSize(20)
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

    describe("dbs statement", () => {
        test('extract consolidated statement', async () => {
            const file = Bun.file('./test-files/dbsAccountStatement.pdf')
            const buf = await file.arrayBuffer()
            const f = new File([buf], 'file')
            const data = await pdfParser(f, testUser.id)
            if ("accounts" in data && !("ordinaryAccount" in data.accounts)) {
                expect(data.accounts).toHaveProperty("My Account")
                expect(data.accounts["My Account"]?.transactions).toBeArrayOfSize(33)
                const hasBadAmount = data.accounts["My Account"]?.transactions.some((t) => isNaN(t.amount))
                expect(hasBadAmount).toBeFalse()
                expect(data.accounts["Supplementary Retirement Scheme Account"]?.transactions).toBeArrayOfSize(0)
            } else {
                throw Error()
            }
        })
    })

})
