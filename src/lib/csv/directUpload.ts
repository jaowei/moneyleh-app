import { parse } from 'csv-parse/sync'
import { directUploadRecordsZ } from "./csv.type.ts";
import { parseDateString } from "../dayjs.ts";
import z from "zod";

export const csvParserDirectUpload = async (file: File) => {
    const fileTxt = await file.text()
    const records = parse(fileTxt, {
        columns: (header) => header.map((h) => h.trim().toLowerCase())
    })

    const { data, success, error } = directUploadRecordsZ.safeParse(records)
    if (success) {
        return data.map((d) => {
            const parseRes = parseDateString(d.date, 'M/D/YY')
            if (parseRes) {
                d.date = parseRes
            } else {
                const parseRes = parseDateString(d.date, 'M/D/YYYY')
                if (parseRes) {
                    d.date = parseRes
                } else {
                    throw new Error('Unable to get date')
                }
            }
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
