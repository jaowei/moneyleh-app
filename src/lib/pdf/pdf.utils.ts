import {extendedDayjs, parseDateString} from "../dayjs.ts";
import {appLogger} from "../../index.ts";

export const parseTxnDate = (dateStr: string, statementDate: string) => {
    // trying to match "02 MAY"
    // 1st group will be 02
    // 2nd group will be MAY
    const matches = dateStr.match(/(\d{2}) ([A-Z]{3})/)
    if (matches && matches[1] && matches[2]) {
        const month = matches[2].charAt(0) + matches[2].slice(1).toLowerCase()
        const statementDateDayjs = extendedDayjs(statementDate)
        let year = statementDateDayjs.year()
        if (statementDateDayjs.month() === 0 && month.toLowerCase() === 'dec') {
            year = statementDateDayjs.year() - 1
        }
        const date = `${matches[1]} ${month} ${year}`
        const parsed = parseDateString(date, 'DD MMM YYYY')
        if (parsed) {
            return parsed
        } else {
            appLogger(`WARN: Could not parse date`)
        }
    } else {
        appLogger(`WARN: No date to add`)
    }
}
