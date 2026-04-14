import { parse } from 'csv-parse/sync'
import { directUploadRecordsZ } from "./csv.type.ts";
import { parseDateString } from "../dayjs.ts";
import z from "zod";
import { HTTPException } from 'hono/http-exception';

const parseDate = (dateString: string, rowIndex: number) => {
    const formats = ['YYYY-MM-DD']
    const result = formats.map((format) => parseDateString(dateString, format)
    ).filter((date) => !!date)
    const parsedDate = result[0]
    if (!result.length || !parsedDate) {
        throw new HTTPException(400, {
            message: `Unexpected format, row: "${rowIndex}", date given: "${dateString}", expected format "YYYY-MM-DD"`
        })
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
