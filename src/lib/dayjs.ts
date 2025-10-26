import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import updateLocale from 'dayjs/plugin/updateLocale'

dayjs.extend(customParseFormat)
dayjs.extend(updateLocale)

export const extendedDayjs = dayjs

export const parseDateString = (dateToParse: string, format: string) => {
    const date = dayjs(dateToParse, format, true)
    if (date.isValid()) {
        return date.toISOString()
    }
}