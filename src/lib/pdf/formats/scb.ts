import dayjs from "dayjs";
import { appLogger } from "../../..";
import { ParsingErrors } from "../../../errors";
import { parseDateString } from "../../dayjs";
import type { CardStatementData, MuPdfStructuredTextBlock, PdfFormat, PdfFormatExtractor } from "../pdf.type";

const extractDataCard: PdfFormatExtractor = (dataToExtract, userId) => {
    const extractedData: CardStatementData = {
        type: 'card',
        statementDate: '',
        cards: {},
        dueDate: '',
        creditLimit: 0,
        points: {}
    }
    let currency = 'SGD'
    const firstPage = dataToExtract[0]
    if (!firstPage) {
        throw ParsingErrors.page
    }

    const cardDetailsBlockStartIdx = firstPage.blocks.findIndex((block) => block.lines.find((line) => line.text.includes('Account/Card No.')))
    const creditLimitBlock = firstPage.blocks.find((block) => block.lines.find((line) => line.text.includes('Approved Credit Limit')))
    const dueDateBlock = firstPage.blocks.find((block) => block.lines.find((line) => line.text.includes('Payment Due Date')))
    const statementDateBlock = firstPage.blocks.find((block) => block.lines.find((line) => line.text.includes('Statement Date')))

    for (let i = cardDetailsBlockStartIdx + 1; i < cardDetailsBlockStartIdx + 5; i++) {
        const block = firstPage.blocks[i]
        if (block?.lines.find((line) => line.text.includes('TOTAL'))) break;

        if (!block) continue

        const cardName = block.lines[0]?.text
        const cardNumber = block.lines[1]?.text
        if (cardName && cardNumber) {
            extractedData.cards[cardName] = {
                transactions: [],
                cardNumber,
                total: 0
            }
        } else {
            throw ParsingErrors.cardDetails
        }
    }

    const statementDateLine = statementDateBlock?.lines.at(-1)
    if (statementDateLine) {
        const date = parseDateString(statementDateLine.text, 'DD MMM YYYY')
        if (date) {
            extractedData.statementDate = date
        } else {
            throw ParsingErrors.statementDate
        }
    } else {
        throw ParsingErrors.statementDate
    }

    const dueDateLine = dueDateBlock?.lines.at(-1)
    if (dueDateLine) {
        const date = parseDateString(dueDateLine.text, 'DD MMM YYYY')
        if (date) {
            extractedData.dueDate = date
        } else {
            throw ParsingErrors.dueDate
        }
    } else {
        throw ParsingErrors.dueDate
    }


    if (creditLimitBlock) {
        const yCoord = creditLimitBlock.lines[0]?.y
        const creditLimitAmountBlock = firstPage.blocks.find((block) => block.lines.find((line) => line.y === yCoord))
        const creditLimit = creditLimitAmountBlock?.lines[1]?.text
        if (creditLimit) {
            try {
                extractedData.creditLimit = parseFloat(creditLimit.trim().replaceAll(',', ''))
            } catch (error) {
                appLogger(`WARN: Could not get credit limit ${error}`)
            }
        } else {
            appLogger('WARN: Could not find credit limit amount block')
        }

    } else {
        appLogger('WARN: Could not find credit limit block')
    }


    const allBlocks: MuPdfStructuredTextBlock[] = []
    dataToExtract.forEach((data) => {
        allBlocks.push(...data.blocks.flat())
    })

    Object.keys(extractedData.cards).forEach((cardName) => {
        const startTransactionIdx = allBlocks.findIndex((block) =>
            block.lines.find((line) => line.text.includes('BALANCE FROM PREVIOUS STATEMENT')))
        const endTransactionIdx = allBlocks.findIndex((block) =>
            block.lines.find((line) => line.text.includes('NEW BALANCE')))

        for (let i = startTransactionIdx + 1; i < endTransactionIdx; i++) {
            const transactionBlock = allBlocks[i]
            if (!transactionBlock) continue

            const unformattedDateLine = transactionBlock.lines[0]
            if (!unformattedDateLine) continue
            const year = dayjs(extractedData.statementDate).year()
            const transactionDate = `${unformattedDateLine.text} ${year}`
            const unformattedAmount = transactionBlock.lines.at(-1)?.text

            let amount = 0
            if (unformattedAmount) {
                try {
                    amount = parseFloat(unformattedAmount.trim().replaceAll(',', '')) * -1
                } catch (error) {
                    appLogger(`Error parsing amount: ${error}`)
                }
            }

            const rowYCoord = unformattedDateLine.y
            const descriptionBlock = allBlocks.find((block) => block.lines.find((line) => line.y === rowYCoord))
            let description = ''
            if (descriptionBlock) {
                description = descriptionBlock.lines.map((l) => l.text).join(' ')
            }

            extractedData.cards[cardName]?.transactions.push({
                transactionDate,
                currency,
                amount,
                userId,
                description
            })
        }
    })

    return extractedData
}


export const scbCard: PdfFormat = {
    searchString: 'standard chartered',
    extractData: extractDataCard
}