import dayjs from "dayjs";
import { parseDateString } from "../../dayjs";
import type { AccountStatementData, PdfFormat, PdfFormatExtractor } from "../pdf.type";

const extractData: PdfFormatExtractor = (dataToExtract, userId) => {
    const data: AccountStatementData = {
        type: "account",
        statementDate: "",
        accounts: {
            chocolateManagedAccount: {
                accountNumber: '',
                transactions: []
            }
        }
    }
    const dataIdx = {
        transactions: -1
    }
    let statementYear: number | undefined = undefined

    dataToExtract.forEach((page, pageNum) => {
        const { blocks } = page
        blocks.forEach((block, blockIdx) => {
            const firstLine = block.lines[0]

            if (!firstLine) return

            if (pageNum === 0) {
                const parsedDate = parseDateString(firstLine.text, 'MMMM YYYY')
                if (parsedDate) {
                    const lastDayOfMonth = dayjs(parsedDate).endOf('month')
                    statementYear = lastDayOfMonth.year()
                    data.statementDate = lastDayOfMonth.toISOString()
                }
            }

            if (pageNum === 1) {
                if (firstLine.text.includes('Your transactions')) {
                    dataIdx.transactions = blockIdx + 2
                }

                if (blockIdx >= dataIdx.transactions && block.lines.length === 4) {
                    let transactionDate = ''
                    let amount = 0
                    let currency = 'SGD'

                    const parsedDate = parseDateString(firstLine.text, 'D MMM')
                    if (parsedDate && statementYear) {
                        transactionDate = dayjs(parsedDate).year(statementYear).toISOString()
                    }

                    const moneyOutXCoord = 390
                    if (!block.lines[2]) return

                    const cleanAmtStr = block.lines[2].text.slice(2).trim()
                    const extractedCurr = block.lines[2].text.slice(0, 2)
                    if (extractedCurr !== 'S$') {
                        currency = 'USD'
                    }

                    if (block.lines[2].x > moneyOutXCoord) {
                        amount = -1 * parseFloat(cleanAmtStr)
                    } else {
                        amount = parseFloat(cleanAmtStr)
                    }

                    data.accounts.chocolateManagedAccount?.transactions.push({
                        transactionDate,
                        description: block.lines[1]?.text || '',
                        amount,
                        currency,
                        userId
                    })
                }
            }
        })
    })
    return data
}

export const chocolate: PdfFormat = {
    searchString: 'chocolatefinance.com',
    extractData
}