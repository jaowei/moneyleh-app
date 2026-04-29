import { extendedDayjs, parseDateString } from "../dayjs.ts";

/**
 * @param dateStr we expect transaction dates to only contain day and month
 * @param statementDate a statement date in ISO format
 * @returns either a date in ISO string format or undefined if unable to parse
 */
export const parseTxnDate = (dateStr: string, statementDate: string) => {
    const statementDateDayjs = extendedDayjs(statementDate)
    let txnYear = statementDateDayjs.year()
    const isJanStatement = statementDateDayjs.month() === 0

    // match "02 MAY", 1st group will be 02, 2nd group will be MAY
    const allCapDateMatch = dateStr.match(/(\d{1,2}) ([A-Z]{3})/)
    if (allCapDateMatch && allCapDateMatch[1] && allCapDateMatch[2]) {
        const txnMonth = allCapDateMatch[2].charAt(0) + allCapDateMatch[2].slice(1).toLowerCase()
        if (isJanStatement && txnMonth.toLowerCase() === 'dec') {
            txnYear -= 1
        }
        const date = `${allCapDateMatch[1]} ${txnMonth} ${txnYear}`
        const parsed = parseDateString(date, ['DD MMM YYYY', 'D MMM YYYY'])
        return parsed
    } else {
        const txnDate = extendedDayjs(dateStr, ['D MMM', 'DD MMM'])
        if (txnDate.isValid()) {
            if (isJanStatement && txnDate.month() === 11) {
                txnYear -= 1
            }
            return txnDate.year(txnYear).toISOString()
        }
    }

}
