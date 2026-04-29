import { describe, expect, test } from 'bun:test'
import { parseTxnDate } from './pdf.utils'
import { extendedDayjs } from '../dayjs'

describe('PDF utils', () => {
    describe('parse transaction dates', () => {
        describe('all caps dates', () => {
            test('transaction in previous year', () => {
                const date = extendedDayjs().month(0) // jan statement
                const result = parseTxnDate('12 DEC', date.toISOString())
                expect(result).toInclude(`${date.year() - 1}-12-12`)
            })
            test('single digit days', () => {
                const date = extendedDayjs()
                const result = parseTxnDate('1 JAN', date.toISOString())
                expect(result).toInclude(`${date.year()}-01-01`)
            })
            test('double digit days', () => {
                const date = extendedDayjs()
                const result = parseTxnDate('11 JAN', date.toISOString())
                expect(result).toInclude(`${date.year()}-01-11`)
            })
        })
        describe('pascal case dates', () => {
            test('transaction in previous year', () => {
                const date = extendedDayjs().month(0) // jan statement
                const result = parseTxnDate('12 Dec', date.toISOString())
                expect(result).toInclude(`${date.year() - 1}-12-12`)
            })
            test('single digit days', () => {
                const date = extendedDayjs()
                const result = parseTxnDate('1 Dec', date.toISOString())
                expect(result).toInclude(`${date.year()}-12-01`)
            })
            test('double digit days', () => {
                const date = extendedDayjs()
                const result = parseTxnDate('11 Dec', date.toISOString())
                expect(result).toInclude(`${date.year()}-12-11`)
            })
        })
    })
})