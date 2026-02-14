import * as mupdf from 'mupdf'
import {
    type MuPdfStructuredTextPage, MuPdfStructuredTextPageZ
} from "./pdf.type.ts";
import { dbsCard, dbsAccount } from "./formats/dbs.ts";
import { cpf } from "./formats/cpf.ts";
import { chocolate } from './formats/chocolate.ts';
import { uobAccount, uobCard } from './formats/uob.ts';
import { trustCard } from './formats/trust.ts';

const parseStatementPages = (document: mupdf.Document) => {
    const dataToExtract: MuPdfStructuredTextPage[] = []
    for (let i = 0; i < document.countPages(); i++) {
        const page = document.loadPage(i)
        const convertedText = page.toStructuredText("preserve-spans").asJSON()
        try {
            const blockData = JSON.parse(convertedText)
            const parsedData = MuPdfStructuredTextPageZ.parse(blockData)
            dataToExtract.push(parsedData)
        } catch (e) {
            throw new Error(`Error converting page text: ${JSON.stringify(e)}`)
        }
    }
    return dataToExtract
}

const getDataExtractorForFormat = (doc: mupdf.Document) => {
    const firstPage = doc.loadPage(0)
    if (firstPage.search(dbsCard.searchString).length) {
        return dbsCard.extractData
    } else if (dbsAccount.searchFn?.(firstPage)) {
        return dbsAccount.extractData
    } else if (firstPage.search(cpf.searchString).length) {
        return cpf.extractData
    } else if (firstPage.search(chocolate.searchString).length) {
        return chocolate.extractData
    } else if (uobCard.searchFn?.(firstPage)) {
        return uobCard.extractData
    } else if (uobAccount.searchFn?.(firstPage)) {
        return uobAccount.extractData
    } else if (firstPage.search(trustCard.searchString)) {
        return trustCard.extractData
    }
    else {
        throw new Error('Unable to determine PDF statement format')
    }
}

export const pdfParser = async (file: File, userId: string) => {
    const doc = mupdf.PDFDocument.openDocument(await file.arrayBuffer())
    if (!doc.countPages()) {
        throw new Error(`Document does not have any pages!`)
    }

    const extractor = getDataExtractorForFormat(doc)
    if (extractor) {
        const dataToExtract = parseStatementPages(doc)
        return extractor(dataToExtract, userId)
    } else {
        throw new Error(`Cannot determine format for file: ${file.name}`)
    }
}