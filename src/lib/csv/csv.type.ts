import z from "zod";

const directUploadFormatZ = z.object({
    date: z.string(),
    tags: z.string().transform((val) => !val ? [] : val.toLowerCase().split('_')),
    currency: z.string().length(3),
    amount: z.string().transform((val, ctx) => {
            try {
                let sign = 1
                if (val.includes("(")) {
                    sign = -1
                }
                const cleanStr = val.replaceAll("(", "")
                    .replaceAll("(", "")
                    .replaceAll("$", "")
                    .replaceAll(",", "")
                return parseFloat(cleanStr) * sign
            } catch (e) {
                ctx.issues.push({
                    code: 'custom',
                    message: "Can't parse string",
                    input: val
                })
                return z.NEVER
            }
        }
    ),
    description: z.string().default(''),
    // TODO: remove these once all migrated
    transactionmethod: z.string().toLowerCase().optional(),
    transactiontype: z.string().toLowerCase().optional()
})

export const directUploadRecordsZ = z.array(directUploadFormatZ)