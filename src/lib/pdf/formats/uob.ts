import dayjs from "dayjs";
import { appLogger } from "../../..";
import { parseDateString } from "../../dayjs";
import type { AccountStatementData, CardStatementData, MuPdfStructuredLine, MuPdfStructuredTextBlock, MuPdfStructuredTextPage, PdfFormat, PdfFormatExtractor } from "../pdf.type";
import { parseTxnDate } from "../pdf.utils";
import type { TransactionsInsertSchema } from "../../../db/schema";


const extractDataCard: PdfFormatExtractor = (dataToExtract, userId) => {
    const parseCreditLimitAmount = (amount: string) => {
        const cleaned = amount.trim().replaceAll(',', '').slice(4)
        try {
            return parseFloat(cleaned)
        } catch {
            return undefined
        }
    }

    const parseTxnAmountBlock = (amountBlock: MuPdfStructuredTextBlock) => {
        try {
            if (!amountBlock.lines[0]) return
            const cleanAmt = amountBlock.lines[0].text.replaceAll(',', '').trim()
            if (amountBlock?.lines?.[1]?.text.includes('CR')) {
                return parseFloat(cleanAmt)
            } else {
                return -1 * parseFloat(cleanAmt)
            }
        } catch (error) {
            return undefined
        }
    }

    const parseTxnAmountLine = (amountLine: MuPdfStructuredLine) => {
        try {
            return parseFloat(amountLine.text)
        } catch (error) {
            return undefined
        }
    }

    const getParsableUOBDate = (dateString: string) => {
        // format is 12  DEC  2025, note there are 2 spaces and month is all caps
        return dateString.replace(/[A-Z]{3}/, (match) => match.at(0) + match.slice(1).toLowerCase())
    }

    const extractedData: CardStatementData = {
        type: 'card',
        statementDate: '',
        cards: {},
        dueDate: '',
        creditLimit: 0,
        points: {}
    }
    let currentCard: string | undefined = undefined;
    let currency = 'SGD'

    dataToExtract.forEach((page, pageNum) => {
        page.blocks.forEach((block, blockIdx) => {
            const firstLine = block.lines[0]
            if (!firstLine) return

            if (pageNum === 0 && blockIdx < 10) {
                if (firstLine.text.includes('Statement Date') && block.lines[1]) {
                    const parsableDate = getParsableUOBDate(block.lines[1].text)
                    const parsedDate = parseDateString(parsableDate, 'DD  MMM  YYYY')
                    if (parsedDate) {
                        extractedData.statementDate = parsedDate
                    } else {
                        appLogger('WARN: Could not parse statement date')
                    }
                }
                if (firstLine.text.includes('Total Credit Limit') && block.lines[1]) {
                    const parsedLimt = parseCreditLimitAmount(block.lines[1].text)
                    if (parsedLimt) {
                        extractedData.creditLimit = parsedLimt
                    } else {
                        appLogger('WARN: Could not parse credit limit')
                    }
                }
                if (firstLine.text.includes('Due Date') && block.lines[1]) {
                    const parsableDate = getParsableUOBDate(block.lines[1].text)
                    const parsedDate = parseDateString(parsableDate, 'DD  MMM  YYYY')
                    if (parsedDate) {
                        extractedData.dueDate = parsedDate
                    } else {
                        appLogger('WARN: Could not parse due date')
                    }
                }
            }

            const startOfTxnBlock = block.lines.length === 2 && firstLine.text === 'Post'
            if (startOfTxnBlock) {
                const cardNumBlock = page.blocks.at(blockIdx - 1)
                const cardNameBlock = page.blocks.at(blockIdx - 2)
                const currencyBlock = page.blocks.at(blockIdx + 3)
                if (currencyBlock && currencyBlock.lines[0]?.text) {
                    currency = currencyBlock.lines[0].text
                }
                if (cardNameBlock) {
                    const cardName = cardNameBlock.lines[0]?.text
                    if (cardName && !extractedData.cards[cardName]?.cardNumber) {
                        extractedData.cards[cardName] = {
                            transactions: [],
                            total: 0,
                            cardNumber: ''
                        }
                        if (cardNumBlock) {
                            const cardNum = cardNumBlock.lines[0]?.text
                            if (cardNum) {
                                extractedData.cards[cardName].cardNumber = cardNum
                            }
                        }
                        currentCard = cardName
                    }
                }
                // skip to next block, list of txns
                return
            }

            if (currentCard) {
                if (firstLine.text === 'SUB TOTAL') {
                    currentCard = undefined
                    return
                }
                const postDate = parseTxnDate(firstLine.text, extractedData.statementDate)
                if (!postDate) return

                const secondLine = block.lines[1]
                if (!secondLine) return

                const transactionDate = parseTxnDate(secondLine.text, extractedData.statementDate)
                const blockHasNoAmount = block.lines.at(-1)?.text.includes('Ref')

                let amount = 0
                let description = ''
                if (blockHasNoAmount) {
                    const amountBlock = page.blocks.at(blockIdx + 1)
                    if (!amountBlock) return
                    amount = parseTxnAmountBlock(amountBlock) || 0
                    description = block.lines.slice(2).map((l) => l.text).join(' ')
                } else {
                    description = block.lines[2]?.text || ''
                    const amountBlock = block.lines.at(-1)
                    if (!amountBlock) return
                    amount = parseTxnAmountLine(amountBlock) || 0
                }

                const cardData = extractedData.cards[currentCard]

                if (transactionDate && cardData) {
                    if (amount < 0) {
                        cardData.total += amount
                    }
                    cardData.transactions.push({
                        transactionDate,
                        description,
                        currency,
                        userId,
                        amount
                    })
                }
            }
        })
    })
    return extractedData
}

const extractDataAccount: PdfFormatExtractor = (dataToExtract, userId) => {
    const extractedData: AccountStatementData = {
        type: 'account',
        accounts: {},
        statementDate: ''
    }
    let currency = 'SGD'

    const getAccountDetails = (firstPage: MuPdfStructuredTextPage) => {
        const depositHeaderIdx = firstPage.blocks.findIndex((block) =>
            block.lines.length === 1 && block.lines[0]?.text === 'Deposits'
        )
        if (depositHeaderIdx > 0) {
            const accountNameBlock = firstPage.blocks.at(depositHeaderIdx + 2)
            return {
                accountName: accountNameBlock?.lines.at(1)?.text,
                accountNumber: accountNameBlock?.lines.at(-1)?.text
            }
        }
    }

    const getStatementDate = (firstPage: MuPdfStructuredTextPage) => {
        const periodBlock = firstPage.blocks.find((block) => block.lines.find((line) => line.text.includes('Statement of Account')))
        const periodLine = periodBlock?.lines.at(-1)
        if (!periodLine) return
        const endPeriod = periodLine.text.slice(-11)
        return parseDateString(endPeriod, "DD MMM YYYY")
    }

    const getCurrencyFromBlock = (block?: MuPdfStructuredTextBlock) => {
        return block?.lines[0]?.text.trim().toUpperCase()
    }

    const getTransactionFromBlock = (block?: MuPdfStructuredTextBlock, nextBlock?: MuPdfStructuredTextBlock): TransactionsInsertSchema | undefined => {
        if (!block) return
        const firstLine = block.lines[0]
        if (!firstLine) return

        const firstLineIsDate = !!parseDateString(firstLine.text, "DD MMM")
        if (!firstLineIsDate) return

        const splitOver2Blocks = firstLineIsDate && (block.lines.at(-1)?.text !== "  ")

        const parseAmountLine = (line?: MuPdfStructuredLine) => {
            if (!line) {
                appLogger('WARN: There is no amount line')
                return 0
            }
            const isWithdrawal = line.x < 430
            const sign = isWithdrawal ? -1 : 1

            try {
                const cleanStr = line.text.trim().replaceAll(',', '')
                return parseFloat(cleanStr) * sign
            } catch (error) {
                appLogger(`Error parsing amount`)
                return 0
            }

        }

        const statementYear = dayjs(extractedData.statementDate).year()
        const transactionDate = parseDateString(`${firstLine.text} ${statementYear}`, 'DD MMM YYYY') || firstLine.text
        let description
        let amount
        if (!splitOver2Blocks) {
            description = block.lines[1]?.text || ''
            amount = parseAmountLine(block.lines[2])
        } else {
            description = block.lines.slice(1).map((l) => l.text).join(' ')
            if (!nextBlock) {
                appLogger('No next block, skipping txn parsing...')
                return
            }
            const amountLine = nextBlock.lines[0]
            amount = parseAmountLine(amountLine)
        }
        return {
            transactionDate,
            description,
            currency,
            userId,
            amount
        }
    }

    const firstPage = dataToExtract[0]
    const remainingBlocks = dataToExtract.slice(1).map((p) => p.blocks).flat()
    if (!firstPage) {
        appLogger('WARN: No first page!')
    } else {
        const accountDetails = getAccountDetails(firstPage)
        if (accountDetails && accountDetails?.accountName && accountDetails?.accountNumber) {
            extractedData.accounts[accountDetails.accountName] = {
                transactions: [],
                accountNumber: accountDetails.accountNumber
            }
        }
        const statementDate = getStatementDate(firstPage)
        if (!statementDate) {
            appLogger('WARN: Statement date not found')
        } else {
            extractedData.statementDate = statementDate
        }
    }

    Object.keys(extractedData.accounts).forEach((accountName) => {
        const accountHeaderIdx = remainingBlocks.findIndex((block) => block.lines.find((l) => l.text.includes(accountName)))

        const currencyIdx = accountHeaderIdx + 2
        const currencyBlock = remainingBlocks.at(currencyIdx)
        currency = getCurrencyFromBlock(currencyBlock) || currency

        const transactionsStartIdx = accountHeaderIdx + 8
        const transactionEndIdx = remainingBlocks.findIndex((block, findingIdx) =>
            findingIdx > accountHeaderIdx && block.lines.find((line) => line.text.includes("Total"))
        )

        for (let i = transactionsStartIdx; i < transactionEndIdx; i++) {
            const transactionBlock = remainingBlocks[i]
            const txn = getTransactionFromBlock(transactionBlock, remainingBlocks[i + 1])
            if (txn) {
                extractedData.accounts[accountName]?.transactions.push(txn)
            }
        }

        // TODO: Balance check
        // const begBalanceBlock = remainingBlocks.at(transactionsStartIdx)
        // const totalAmountBlock = remainingBlocks.at(transactionEndIdx)
    })


    return extractedData
}

export const uobCard: PdfFormat = {
    searchString: '',
    searchFn: (page) => {
        const hasCreditCard = !!page.search('Credit Card').length
        const hasUobName = !!page.search('uobgroup').length
        return hasCreditCard && hasUobName
    },
    extractData: extractDataCard
}
export const uobAccount: PdfFormat = {
    searchString: '',
    searchFn: (page) => {
        const hasAccountHeader = !!page.search('Statement of Account').length
        const hasUobName = !!page.search('uobgroup').length
        return hasAccountHeader && hasUobName
    },
    extractData: extractDataAccount
}