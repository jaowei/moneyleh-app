import { parse } from 'csv-parse/sync'
import { directUploadRecordsZ } from "./csv.type.ts";
import { parseDateString } from "../dayjs.ts";
import z from "zod";

const parseDate = (dateString: string, rowIndex: number) => {
    const formats = ['M/D/YY', 'M/D/YYYY', 'D/M/YYYY', 'D/M/YY', 'D-MMM-YY']
    const result = formats.map((format) => parseDateString(dateString, format)
    ).filter((date) => !!date)
    const parsedDate = result[0]
    if (!result.length || !parsedDate) {
        throw new Error(`Unable to get date for row ${rowIndex}`)
    } else {
        return parsedDate
    }

}

export const csvParserDirectUpload = async (file: File) => {
    const fileTxt = await file.text()
    const records = parse(fileTxt, {
        columns: (header) => header.map((h) => h.trim().toLowerCase()),
        skip_empty_lines: true,
        skip_records_with_empty_values: true
    })

    const { data, success, error } = directUploadRecordsZ.safeParse(records)
    if (success) {
        return data.map((d, idx) => {
            d.date = parseDate(d.date, idx + 1)
            if (d.transactionmethod) {
                d.tags.push(d.transactionmethod)
            }
            if (d.transactiontype) {
                d.tags.push(d.transactiontype)
            }
            return d
        })
    } else {
        throw new Error(z.prettifyError(error))
    }
}
