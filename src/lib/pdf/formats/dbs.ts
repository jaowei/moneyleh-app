import type {
    MuPdfStructuredLine,
    MuPdfStructuredTextBlock,
    MuPdfStructuredTextPage,
    StatementData
} from "../pdf.type.ts";
import {extendedDayjs, parseDateString} from "../../dayjs.ts";
import {appLogger} from "../../../index.ts";

const extractStatementMetadata = (block: MuPdfStructuredTextBlock) => {
    const data = {
        statementDate: '',
        creditLimit: -1,
        dueDate: ''
    }
    if (block.lines[0]) {
        const parsed = parseDateString(block.lines[0].text, 'DD MMM YYYY')
        if (parsed) {
            data.statementDate = parsed
        } else {
            appLogger('WARN: Unable to parse statement date format')
        }
    } else {
        appLogger(`WARN: Unable to detect statement date`)
    }
    if (block.lines[1]) {
        if (block.lines[1].text.startsWith('$')) {
            try {
                const cleanValue = block.lines[1].text.replaceAll(",", "").replaceAll("$", "")
                data.creditLimit = parseInt(cleanValue)
            } catch (e) {
                appLogger(`WARN: Unable to parse credit limit value: ${e}`)
            }
        }
    } else {
        appLogger(`WARN: Unable to detect credit limit`)
    }
    if (block.lines[3]) {
        const parsed = parseDateString(block.lines[3].text, 'DD MMM YYYY')
        if (parsed) {
            data.dueDate = parsed
        } else {
            appLogger('WARN: Unable to parse due date format')
        }
    } else {
        appLogger(`WARN: Unable to detect statement due date`)
    }
    return data
}

const parsePointsSummaryLine = (pointLine?: MuPdfStructuredLine) => {
    const value = pointLine?.text?.replaceAll(',', '')
    if (!value) return 0

    if (value.toLowerCase().includes('no expiry')) {
        return 0
    }
    return parseInt(value)

}

const extractPointsData = (block: MuPdfStructuredTextBlock) => {
    if (!block.lines[0]) {
        appLogger(`WARN: Card number does not exist on point summary`)
    }
    return {
        cardNum: block.lines[0]?.text || '',
        startBalance: parsePointsSummaryLine(block.lines[1]),
        earned: parsePointsSummaryLine(block.lines[2]),
        redeemed: parsePointsSummaryLine(block.lines[3]),
        endBalance: parsePointsSummaryLine(block.lines[4]),
        expiring: parsePointsSummaryLine(block.lines[5]),
    }
}

const parseAmount = (amountLine: MuPdfStructuredLine) => {
    const clean = amountLine.text.replaceAll(',', '')
    let sign = -1
    if (clean.includes('CR')) {
        sign = 1
    }
    try {
        return parseFloat(clean) * sign
    } catch (e) {
        appLogger(`WARN: Unable to parse transaction amount`)
    }
}

const parseTxnDate = (dateStr: string, statementDate: string) => {
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

const extractData = (dataToExtract: MuPdfStructuredTextPage[]) => {
    const dataIdx = {
        statementDate: -1,
        pointsSummary: -1
    }
    let currentCardName = ''
    const data: StatementData = {
        statementDate: '',
        dueDate: '',
        creditLimit: -1,
        cards: {},
        points: {}
    }
    let inCardTxn = false
    let currency: string = ''
    dataToExtract.forEach((pageData, pageNum) => {
        const {blocks} = pageData
        blocks.forEach((block, blockIdx) => {
            if (block.type === 'image') {
                appLogger(`WARN: Image detected, ignoring...`)
                return
            }

            if (!block.lines.length) {
                appLogger(`WARN: Empty block detected, ignoring...`)
                return
            }

            const startingLineText = block.lines.at(0)
            if (!startingLineText) return
            if (startingLineText.text.toLowerCase().includes('statement date')) {
                dataIdx.statementDate = blockIdx + 1
            } else if (startingLineText.text.toLowerCase().includes('points summary')) {
                dataIdx.pointsSummary = blockIdx + 1
            } else if (startingLineText.text.toLowerCase() === 'date') {
                if (block.lines[2]?.text.toLowerCase().includes('s$')) {
                    currency = 'SGD'
                } else {
                    appLogger(`WARN: No currency detected!`)
                }
            } else {
                const matchRes = startingLineText.text.match(/(.+) CARD NO\.: ([0-9]{4} [0-9]{4} [0-9]{4} [0-9]{4})/)
                if (matchRes?.length) {
                    appLogger(`Card found! (${matchRes[1]})`)
                    const cardName = matchRes[1]
                    const cardNumber = matchRes[2]
                    if (cardName && cardNumber) {
                        currentCardName = cardName
                        data.cards[cardName] = {
                            transactions: [],
                            total: 0,
                            cardNumber
                        }
                        inCardTxn = true
                    } else {
                        appLogger(`WARN: Card name could not be found`)
                    }
                }
            }

            if (dataIdx.statementDate === blockIdx) {
                const {statementDate, creditLimit, dueDate} = extractStatementMetadata(block)
                data.statementDate = statementDate
                data.creditLimit = creditLimit
                data.dueDate = dueDate
                // reset index
                dataIdx.statementDate = -1
            }

            if (dataIdx.pointsSummary > 0 && blockIdx > dataIdx.pointsSummary) {
                if (block.lines.length > 6) return
                if (block.lines[0]?.text.toLowerCase() === 'total') {
                    dataIdx.pointsSummary = -1
                    return
                }
                const {cardNum, ...rest} = extractPointsData(block)
                data.points[cardNum] = {...rest}
            }

            if (inCardTxn) {
                if (block.lines.length <= 2) {
                    if (block.lines[0]?.text.includes('SUB-TOTAL:')) {
                        const cardData = data.cards[currentCardName]
                        // TODO: Figure out how to check for discrepancy rather than taking the statement value
                        // have to match even with the credit card payment transaction line
                        if (cardData && block.lines[1]) {
                            cardData.total = parseAmount(block.lines[1]) || 0
                        }
                    } else if (block.lines[0]?.text.toLowerCase() === 'total:') {
                        appLogger(`End of card transactions!`)
                        inCardTxn = false
                    }
                    return
                }
                const transaction = {
                    transactionDate: '',
                    description: '',
                    amount: Number.NaN,
                    currency
                }
                let descStartIdx = 1
                if (block.lines[0]) {
                    let txnDate = block.lines[0].text
                    if (block.lines[0].text.includes('NEW TRANSACTIONS') && block.lines[1]) {
                        appLogger(`Starting of transactions list for card (${currentCardName})`)
                        txnDate = block.lines[1].text
                        descStartIdx += 1
                    }
                    transaction.transactionDate = parseTxnDate(txnDate, data.statementDate) || txnDate
                } else {
                    appLogger(`WARN: Invalid transaction block, has no lines`)
                }

                transaction.description = block.lines.slice(descStartIdx, block.lines.length - 1).map((line) => line.text).join(' ')

                let amountLine = block.lines.at(-1)
                if (amountLine) {
                    transaction.amount = parseAmount(amountLine) || 0
                } else {
                    appLogger(`WARN: Amount block could not be detected`)
                }

                const cardData = data.cards[currentCardName]
                if (cardData) {
                    cardData.transactions.push(transaction)
                } else {
                    appLogger(`WARN: Could not find card transactions store`)
                }
            }

        })
    })
    return data
}


export const dbsCard = {
    searchString: 'DBS Cards',
    extractData
}