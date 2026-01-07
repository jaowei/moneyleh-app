import type {
    AccountStatementData, CardStatementData,
    MuPdfStructuredLine,
    MuPdfStructuredTextBlock,
    PdfFormat, PdfFormatExtractor,
} from "../pdf.type.ts";
import {parseDateString} from "../../dayjs.ts";
import {appLogger} from "../../../index.ts";
import {parseTxnDate} from "../pdf.utils.ts";

const extractStatementMetadataCard = (block: MuPdfStructuredTextBlock) => {
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

const parsePointsSummaryLineCard = (pointLine?: MuPdfStructuredLine) => {
    const value = pointLine?.text?.replaceAll(',', '')
    if (!value) return 0

    if (value.toLowerCase().includes('no expiry')) {
        return 0
    }
    return parseInt(value)

}

const extractPointsDataCard = (block: MuPdfStructuredTextBlock) => {
    if (!block.lines[0]) {
        appLogger(`WARN: Card number does not exist on point summary`)
    }
    return {
        cardNum: block.lines[0]?.text || '',
        startBalance: parsePointsSummaryLineCard(block.lines[1]),
        earned: parsePointsSummaryLineCard(block.lines[2]),
        redeemed: parsePointsSummaryLineCard(block.lines[3]),
        endBalance: parsePointsSummaryLineCard(block.lines[4]),
        expiring: parsePointsSummaryLineCard(block.lines[5]),
    }
}

const parseAmountCard = (amountLine: MuPdfStructuredLine) => {
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

const extractDataCard: PdfFormatExtractor = (dataToExtract, userId) => {
    const dataIdx = {
        statementDate: -1,
        pointsSummary: -1
    }
    let currentCardName = ''
    const data: CardStatementData = {
        type: 'card',
        statementDate: '',
        dueDate: '',
        creditLimit: -1,
        cards: {},
        points: {}
    }
    let inCardTxn = false
    let currency: string = ''
    dataToExtract.forEach((pageData) => {
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
                const {statementDate, creditLimit, dueDate} = extractStatementMetadataCard(block)
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
                const {cardNum, ...rest} = extractPointsDataCard(block)
                data.points[cardNum] = {...rest}
            }

            if (inCardTxn) {
                if (block.lines.length <= 2) {
                    if (block.lines[0]?.text.includes('SUB-TOTAL:')) {
                        const cardData = data.cards[currentCardName]
                        // TODO: Figure out how to check for discrepancy rather than taking the statement value
                        // have to match even with the credit card payment transaction line
                        if (cardData && block.lines[1]) {
                            cardData.total = parseAmountCard(block.lines[1]) || 0
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
                    currency,
                    userId
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
                    transaction.amount = parseAmountCard(amountLine) || 0
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

const parseAmountAccount = (line: MuPdfStructuredLine, isWithdrawal: boolean, blockIdx: number) => {
    const cleanAmt = line.text.trim().replaceAll(",", "")
    try {
        return isWithdrawal ? -1 * parseFloat(cleanAmt) : parseFloat(cleanAmt)
    } catch {
        appLogger(`ERROR: Error parsing amount block ${blockIdx}`)
        return undefined
    }
}

const extractDataAccount: PdfFormatExtractor = (dataToExtract, userId) => {
    let pageNum = 0
    const dataIdx = {
        transactionsDetails: -1,
        transactions: -1
    }
    const extractedData: AccountStatementData = {
        type: 'account',
        statementDate: '',
        accounts: {}
    }
    let currentCurrency = 'SGD'
    let currentAccount: string | undefined = undefined
    for (const data of dataToExtract) {
        pageNum++
        const {blocks} = data
        blocks.forEach((block, blockIdx) => {
            const firstLineOfBlock = block.lines[0]

            if (!firstLineOfBlock) return

            if (firstLineOfBlock.text.toLowerCase() === 'account summary') {
                const dateLine = block.lines[1]
                if (dateLine) {
                    extractedData.statementDate = parseDateString(dateLine.text.slice(-11), 'DD MMM YYYY') || ''
                } else {
                    appLogger(`WARN: could not get statement date`)
                }
            }

            // transaction details pages
            const lastLineOfBlock = block.lines.at(-1)
            if (!lastLineOfBlock) return

            if (firstLineOfBlock.text.includes('Balance Brought Forward')) {
                // SRS accounts do not have currency in this line
                if (lastLineOfBlock.text.length > 5) {
                    currentCurrency = lastLineOfBlock.text.slice(0, 3)
                }
                dataIdx.transactions = blockIdx + 1
            } else if (firstLineOfBlock.text.includes('Balance Carried Forward')) {
                dataIdx.transactions = -1
            } else {
                const accountNumMatch = lastLineOfBlock.text.match(/(Account No.) (.*)/)
                if (accountNumMatch) {
                    const accountName = firstLineOfBlock.text
                    const accountNumber = accountNumMatch[2]
                    if (accountNumber && !extractedData.accounts[accountName]?.accountNumber) {
                        currentAccount = accountName
                        extractedData.accounts[accountName] = {
                            transactions: [],
                            accountNumber
                        }
                    }
                }
            }

            // collect transactions per account
            if (currentAccount && blockIdx >= dataIdx.transactions) {
                if (!extractedData.accounts[currentAccount]?.accountNumber) {
                    appLogger(`WARN account was not found but collecting transactions`)
                }

                // parse date
                const transactionDate = parseDateString(firstLineOfBlock.text, 'DD/MM/YYYY')
                // the current block contains amount only skip to the next block
                if (!transactionDate) {
                    return
                }

                // parse amount
                const potentialAmountOnSameBlock = block.lines[2]
                const coordThresholdForWithdrawal = 445
                let amount = 0
                let description = ''

                if (potentialAmountOnSameBlock) {
                    const amountOnSameBlock = parseAmountAccount(potentialAmountOnSameBlock, potentialAmountOnSameBlock.bbox.x < coordThresholdForWithdrawal, blockIdx)
                    if (amountOnSameBlock) {
                        amount = amountOnSameBlock
                        description = block.lines[1]?.text || ''
                    } else {
                        const nextBlock = blocks[blockIdx + 1]
                        const amountLineOnNextBlock = nextBlock?.lines[0]
                        if (nextBlock && amountLineOnNextBlock) {
                            const amountOnNextBlock = parseAmountAccount(amountLineOnNextBlock, nextBlock.bbox.x < coordThresholdForWithdrawal, blockIdx + 1)
                            if (amountOnNextBlock) {
                                amount = amountOnNextBlock
                            }
                            description = block.lines.slice(1).map((l) => l.text).join(' ')
                        }
                    }
                }

                extractedData.accounts[currentAccount]?.transactions.push({
                    transactionDate,
                    currency: currentCurrency,
                    amount,
                    userId,
                    description
                })
            }
        })

    }

    return extractedData
}

export const dbsCard: PdfFormat = {
    searchString: 'DBS Cards',
    extractData: extractDataCard
}
export const dbsAccount: PdfFormat = {
    searchString: 'Consolidated Statement',
    searchFn: (page) => {
        const statementName = page.search('Consolidated Statement').length
        const companyName1 = page.search('DBS Co.').length
        const companyName2 = page.search('POSB Biz').length
        return !!statementName && !!companyName1 && !!companyName2
    },
    extractData: extractDataAccount
}
