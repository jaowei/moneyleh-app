import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import updateLocale from 'dayjs/plugin/updateLocale'
import utc from 'dayjs/plugin/utc'

dayjs.extend(customParseFormat)
dayjs.extend(updateLocale)
dayjs.extend(utc)

export const extendedDayjs = dayjs

export const parseDateString = (dateToParse: string, format: string) => {
    const date = dayjs(dateToParse, format, true)
    if (date.isValid()) {
        return date.toISOString()
    }
}