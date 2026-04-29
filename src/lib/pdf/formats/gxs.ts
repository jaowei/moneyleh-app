import { ParsingErrors } from "../../../errors";
import {  parseDateString } from "../../dayjs";
import type { AccountStatementData, MuPdfStructuredLine, PdfFormat, PdfFormatExtractor, StatementData } from "../pdf.type";
import { parseTxnDate } from "../pdf.utils";

const parseGxsDate = (dateString: string) => {
    const parsed = parseDateString(dateString, 'D MMM YYYY')
    if (!parsed) {
        throw ParsingErrors.statementDate
    }
    return parsed
}

const getStatementDetails = (allText: string[][]) => {
    const accountInfoBlock = allText.find((block) => block.length === 3 && parseDateString(block[0] || '', 'D MMM YYYY'))
    if (!accountInfoBlock) {
        throw ParsingErrors.statementDate
    }
    return {
        statementDate: parseGxsDate(accountInfoBlock[0] || ''),
        accountNumber: accountInfoBlock[2]
    }
}

const getAccountTransactions = (allLines: MuPdfStructuredLine[][], statementDate: string, userId: string,
    accountNumber?: string
) => {
    let currentAccount = ''
    const accountsInfo: Record<string, {startIdx: number, endIdx: number}> = {}

    for (const [idx, block] of allLines.entries()) {
        const isTxnHeader = block.length === 5 && block[0]?.text.includes('Date')
        const isTxnFooter = block.length === 3 && block[0]?.text.match(/-?[\d,]+\.\d+/)

        if (isTxnFooter) {
            const acc =accountsInfo[currentAccount] 
            if (acc) {
                acc.endIdx = idx
            }
        }

        if (isTxnHeader) {
            const accountNameBlock = allLines[idx - 1]
            if (accountNameBlock?.[0] && accountNameBlock[0].text.length > 1) {
                currentAccount = accountNameBlock[0].text
                accountsInfo[currentAccount] = {
                    startIdx: idx,
                    endIdx: -1
                }
            }
        }
    }

    const accounts: AccountStatementData["accounts"] = {}
    Object.entries(accountsInfo).forEach(([accountName, idxs]) => {
        const groupedLines: Array<string | MuPdfStructuredLine>[] = []
        let tmp: Array<string | MuPdfStructuredLine> = []
        const flatLines = allLines.slice(idxs.startIdx + 1, idxs.endIdx).flat()
        flatLines.forEach((line) => {
            const parsed = parseTxnDate(line.text, statementDate)
            const endTxn = line.x > 510
            if (endTxn && tmp.length) {
                groupedLines.push([...tmp, line])
                tmp = []
            }
            if (tmp.length) {
                tmp.push(line)
            }
            if (parsed && line.text.length < 7) {
                tmp.push(parsed)
            }
        })

        const transactions = groupedLines.map((t) => {
            let transactionDate: string
            if (typeof t[0] === 'string') {
                transactionDate = t[0]
            } else {
                throw ParsingErrors.transactionDate
            }
            const description = t.slice(2, -2).map((l) => typeof l !== 'string' ? l.text : l).join(' ')
            const stringAmt = t.at(-2)
            if (typeof stringAmt === 'string' || !stringAmt) {
                throw ParsingErrors.transactionAmt
            }
            const sign = stringAmt.x > 420 ? 1 : -1
            let amount = 0
            try {
                amount = parseFloat(stringAmt.text.replace(',', '').trim()) * sign
            } catch (e) {
                throw ParsingErrors.transactionAmt
            }
            
            return {
                transactionDate,
                description,
                amount,
                userId,
                currency: 'SGD'
            }
        })
        accounts[accountName] = {
            transactions,
            accountNumber: accountNumber || ''
        }
    })
    return accounts
}

const extractDataAccount: PdfFormatExtractor = (pages, userId) => {
    const data: StatementData = {
        type: 'account',
        statementDate: '',
        accounts: {}
    }
    const allLines = pages.flatMap((page) => page.blocks.map((block) => block.lines))
    const allText = allLines.map((blocks) => blocks.flatMap((line) => line.text))
    const {statementDate, accountNumber} = getStatementDetails(allText)
    data.statementDate = statementDate
    data.accounts = getAccountTransactions(allLines, data.statementDate, userId, accountNumber)

    return data
}

export const gxsAccount: PdfFormat = {
    searchString: 'GXS Savings Account',
    extractData: extractDataAccount
} 