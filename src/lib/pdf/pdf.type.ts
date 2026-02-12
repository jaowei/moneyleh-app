import z from 'zod'
import type { TransactionsInsertSchema } from "../../db/schema.ts";
import { Page, type PDFPage } from "mupdf";

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

interface AccountDataBase {
    transactions: TransactionsInsertSchema[],
}

interface AccountData extends AccountDataBase {
    accountNumber: string
}

interface StatementDataBase {
    statementDate: string;
}

export interface CardStatementData extends StatementDataBase {
    type: 'card';
    dueDate: string;
    creditLimit: number;
    cards: Record<string, CardData> // key is card name
    points: Record<string, PointsData>
}

export interface AccountStatementData extends StatementDataBase {
    type: 'account';
    accounts: Record<string, AccountData> // key is account name
}


export interface CPFStatementData extends StatementDataBase {
    type: 'cpf';
    accounts: {
        ordinaryAccount: AccountDataBase
        specialAccount: AccountDataBase
        medisaveAccount: AccountDataBase
    }
}

export type StatementData = CardStatementData | AccountStatementData | CPFStatementData

export type PdfFormatExtractor = (dataToExtract: MuPdfStructuredTextPage[], userId: string) => StatementData

export interface PdfFormat {
    searchString: string;
    searchFn?: (page: PDFPage | Page) => boolean;
    extractData: PdfFormatExtractor
}