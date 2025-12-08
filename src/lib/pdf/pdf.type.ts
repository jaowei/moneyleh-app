import z from 'zod'
import type {TransactionsInsertSchema} from "../../db/schema.ts";

// Based on https://mupdf.readthedocs.io/en/latest/reference/javascript/types/StructuredText.html

const MuPdfBboxZ = z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
})

const MuPdfStructuredTextLineZ = z.object({
    wmode: z.union([z.literal(0), z.literal(1)]),
    bbox: MuPdfBboxZ,
    font: z.object({
        name: z.string(),
        size: z.number()
    }),
    x: z.number(),
    y: z.number(),
    text: z.string()
})
export type MuPdfStructuredLine = z.infer<typeof MuPdfStructuredTextLineZ>

const MuPdfStructuredTextBlockZ = z.object({
    type: z.enum(['image', 'text']),
    bbox: MuPdfBboxZ,
    lines: z.array(MuPdfStructuredTextLineZ)
})
export type MuPdfStructuredTextBlock = z.infer<typeof MuPdfStructuredTextBlockZ>

export const MuPdfStructuredTextPageZ = z.object({
    blocks: z.array(MuPdfStructuredTextBlockZ)
})
export type MuPdfStructuredTextPage = z.infer<typeof MuPdfStructuredTextPageZ>

export interface CardData {
    transactions: TransactionsInsertSchema[];
    total: number;
    cardNumber: string;
}

interface PointsData {
    startBalance: number;
    earned: number;
    redeemed: number;
    expiring: number;
    endBalance: number;
}

interface AccountData {
    transactions: TransactionsInsertSchema[]
}

interface StatementDataBase {
    statementDate: string;
}

export interface CardStatementData extends StatementDataBase {
    dueDate: string;
    creditLimit: number;
    cards: Record<string, CardData>
    points: Record<string, PointsData>
}

export interface AccountStatementData extends StatementDataBase {
    accounts: Record<string, AccountData>
}


export interface CPFStatementData extends StatementDataBase {
    accounts: {
        ordinaryAccount: AccountData
        specialAccount: AccountData
        medisaveAccount: AccountData
    }
}

export type StatementData = CardStatementData | AccountStatementData | CPFStatementData

export type PdfFormatExtractor = (dataToExtract: MuPdfStructuredTextPage[], userId: string) => StatementData

export interface PdfFormat {
    searchString: string;
    extractData: PdfFormatExtractor
}