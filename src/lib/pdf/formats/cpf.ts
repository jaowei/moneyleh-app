import type {
    CPFStatementData,
    PdfFormat,
    PdfFormatExtractor
} from "../pdf.type.ts";
import {parseDateString} from "../../dayjs.ts";
import {appLogger} from "../../../index.ts";
import type {TransactionsInsertSchema} from "../../../db/schema.ts";
import {parseTxnDate} from "../pdf.utils.ts";

const parseAmount = (amountLine: string) => {
    const clean = amountLine.replaceAll(',', '')
    try {
        return parseFloat(clean)
    } catch (e) {
        appLogger(`WARN: Unable to parse transaction amount`)
    }
}

const parseTxn = (account: string, amountStr?: string) => {
    if (!amountStr) {
        appLogger(`WARN: Could not get ${account} amount`)
        return 0
    }
    const parsed = parseAmount(amountStr)
    if (parsed === undefined) {
        appLogger(`WARN: Could not parse transaction amount for ${account}`)
        return 0
    } else if (parsed) {
        return parsed
    } else {
        // no transaction as the amount is 0
        return 0
    }
}

const extractData: PdfFormatExtractor = (dataToExtract, userId) => {
    const statementData: CPFStatementData = {
        type: 'cpf',
        statementDate: '',
        accounts: {
            ordinaryAccount: {transactions: []},
            specialAccount: {transactions: []},
            medisaveAccount: {transactions: []},
        }
    }
    const abbrMap = new Map<string, string>()
    dataToExtract.forEach((page, pageNum) => {
        const {blocks} = page
        blocks.forEach((block) => {
            const startingLine = block.lines[0]
            if (!startingLine) return

            if (startingLine.text.toLowerCase() === 'transaction history') {
                const statementPeriod = block.lines[1]?.text
                const matches = statementPeriod?.match(/\d{2} \w{3} \d{4}/)
                if (matches?.[0]) {
                    const parsed = parseDateString(matches[0], 'DD MMM YYYY')
                    if (!parsed) {
                        appLogger(`WARN: Could not parse date`)
                    } else {
                        statementData.statementDate = parsed
                    }
                }
            }


            if (block.lines.length >= 5) {
                const txnDate = parseTxnDate(startingLine.text, statementData.statementDate)
                if (txnDate) {
                    if (block.lines[1]?.text.toLowerCase() === 'bal') return
                    const oaAmt = parseTxn('OA', block.lines.at(-3)?.text)
                    const saAmt = parseTxn('SA', block.lines.at(-2)?.text)
                    const maAmt = parseTxn('MA', block.lines.at(-1)?.text)
                    const transaction: TransactionsInsertSchema = {
                        transactionDate: txnDate,
                        currency: 'SGD',
                        amount: oaAmt || saAmt || maAmt,
                        description: block.lines.slice(1, block.lines.length - 3).map((l) => l.text).join(' '),
                        userId
                    }
                    if (oaAmt) {
                        statementData.accounts.ordinaryAccount.transactions.push(transaction)
                    }
                    if (saAmt) {
                        statementData.accounts.specialAccount.transactions.push(transaction)
                    }
                    if (maAmt) {
                        statementData.accounts.medisaveAccount.transactions.push(transaction)
                    }
                }
            }


            if (block.lines.length === 2 && pageNum > 0) {
                if (startingLine.text.toLowerCase() === 'code') return
                abbrMap.set(startingLine.text, block.lines?.[1]?.text || '')
            }
        })
    })

    Object.values(statementData.accounts).forEach((a) => {
        a.transactions.forEach((t) => {
            const code = t.description?.slice(0, 3) || ''
            const fullDesc = abbrMap.get(code)
            if (fullDesc && t.description) {
                t.description += ` ${fullDesc}`
            }
        })
    })
    return statementData
}

export const cpf: PdfFormat = {
    searchString: 'CPF',
    extractData
}