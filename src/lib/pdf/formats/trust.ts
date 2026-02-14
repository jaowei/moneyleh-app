import dayjs from "dayjs";
import { appLogger } from "../../..";
import { ParsingErrors } from "../../../errors";
import { parseDateString } from "../../dayjs";
import type { CardStatementData, PdfFormat, PdfFormatExtractor } from "../pdf.type";

const extractDataCard: PdfFormatExtractor = (dataToExtract, userId) => {
    const extractedData: CardStatementData = {
        type: 'card',
        statementDate: '',
        cards: {
            'ca$hback': {
                total: 0,
                cardNumber: '',
                transactions: []
            }
        },
        creditLimit: 0,
        dueDate: '',
        points: {}
    }
    let currency = 'SGD'

    const firstPage = dataToExtract[0]

    if (!firstPage) {
        throw ParsingErrors.page
    }

    const statementCycleBlock = firstPage.blocks.find((block) => block.lines.find((line) => line.text.includes('Statement cycle')))
    const dueDateBlock = firstPage.blocks.find((block) => block.lines.find((line) => line.text.includes('Payment due date')))
    const creditLimitBlock = firstPage.blocks.find((block) => block.lines.find((line) => line.text.includes('Approved credit limit')))

    const datesLine = statementCycleBlock?.lines[1]
    if (datesLine) {
        const matches = Array.from(datesLine.text.matchAll(/(\d{2} \w{3} )(\d{4})/g))
        const datesAreInLine = matches.length === 2
        const completeDate = matches[1]?.[0]
        const year = matches[0]?.[2]

        if (datesAreInLine && completeDate) {
            const date = parseDateString(completeDate, 'DD MMM YYYY')
            if (date) {
                extractedData.statementDate = date
            } else {
                throw ParsingErrors.statementDate
            }
        } else if (!datesAreInLine && year) {
            const dateAndMonth = datesLine.text.slice(-6)
            const date = parseDateString(`${dateAndMonth} ${year}`, 'DD MMM YYYY')
            if (date) {
                extractedData.statementDate = date
            } else {
                throw ParsingErrors.statementDate
            }
        } else {
            throw ParsingErrors.statementDate
        }
    } else {
        throw ParsingErrors.statementDate
    }

    if (dueDateBlock) {
        const dueDate = dueDateBlock.lines[1]?.text
        if (dueDate) {
            const date = parseDateString(dueDate, 'D MMM YYYY')
            if (date) {
                extractedData.dueDate = date
            } else {
                appLogger('could not parse date')
                throw ParsingErrors.dueDate
            }
        } else {
            appLogger('line not found')
            throw ParsingErrors.dueDate
        }
    } else {
        appLogger('block not found')
        throw ParsingErrors.dueDate
    }

    if (creditLimitBlock) {
        const limit = creditLimitBlock.lines[1]?.text
        if (limit) {
            const cleanStr = limit.trim().replaceAll(',', '').slice(2)
            extractedData.creditLimit = parseFloat(cleanStr)
        }
    }

    const secondPage = dataToExtract[1]

    if (!secondPage) {
        throw ParsingErrors.page
    }

    const transactionStartIdx = secondPage.blocks.findIndex((block) => block.lines.find((line) => line.text.includes('Previous balance')))
    const transactionEndIdx = secondPage.blocks.findIndex((block) => block.lines.find((line) => line.text.includes('Total outstanding balance')))

    const parseAmount = (amountStr: string) => {
        const sign = amountStr.includes('+') ? 1 : -1
        const cleanStr = amountStr.trim().replaceAll(',', '').replaceAll('+', '')
        try {
            return parseFloat(cleanStr) * sign
        } catch (error) {
            appLogger(`WARN: Error parsing amount ${error}`)
        }
    }

    for (let i = transactionStartIdx + 1; i < transactionEndIdx; i++) {
        const transactionBlock = secondPage.blocks[i]
        const firstLine = transactionBlock?.lines[0]

        if (!firstLine) {
            appLogger(`WARN: Block skipped: ${transactionBlock}`)
            continue
        }

        const year = dayjs(extractedData.statementDate).year()
        const transactionDate = parseDateString(`${firstLine.text} ${year}`, 'DD MMM YYYY')

        const match = transactionBlock.lines.at(-1)?.text.match(/\+?\d+.\d+/)
        const unformattedAmount = match?.[0]
        const fullTransactionInBlock = unformattedAmount && transactionDate
        const splitTransaction = !unformattedAmount && transactionDate

        if (fullTransactionInBlock) {
            const description = transactionBlock.lines.slice(2, -1).map((l) => l.text.trim()).join(' ').trim()
            const amount = parseAmount(unformattedAmount)
            if (!amount) {
                continue
            }
            extractedData.cards['ca$hback']?.transactions.push({
                transactionDate,
                userId,
                currency,
                amount,
                description
            })
        } else if (splitTransaction) {
            const descriptionBlock = secondPage.blocks[i + 1]
            const amountBlock = secondPage.blocks[i + 2]
            const description = descriptionBlock?.lines.concat(amountBlock?.lines.slice(0, 2) || []).map((l) => l.text.trim()).join(' ').trim() || ''
            const unformattedAmount = amountBlock?.lines.at(-1)?.text
            if (!unformattedAmount) {
                continue
            }
            const amount = parseAmount(unformattedAmount)
            if (!amount) {
                continue
            }
            extractedData.cards['ca$hback']?.transactions.push({
                transactionDate,
                userId,
                currency,
                amount,
                description
            })
        }
    }

    return extractedData
}

export const trustCard: PdfFormat = {
    searchString: 'Trust Bank Singapore Limited',
    extractData: extractDataCard
}