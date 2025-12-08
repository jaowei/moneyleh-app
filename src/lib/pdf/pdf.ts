import * as mupdf from 'mupdf'
import {
    type MuPdfStructuredTextPage, MuPdfStructuredTextPageZ
} from "./pdf.type.ts";
import {dbsCard} from "./formats/dbs.ts";
import {cpf} from "./formats/cpf.ts";

const pdfFormats = {
    dbsCard: dbsCard,
    cpf: cpf
}

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

const determineFormat = (doc: mupdf.Document) => {
    const firstPage = doc.loadPage(0)
    if (firstPage.search(pdfFormats.dbsCard.searchString).length) {
        return pdfFormats.dbsCard.extractData
    } else if (firstPage.search(pdfFormats.cpf.searchString).length) {
        return pdfFormats.cpf.extractData
    }
}

export const pdfParser = async (file: File, userId: string) => {
    const doc = mupdf.PDFDocument.openDocument(await file.arrayBuffer())
    if (!doc.countPages()) {
        throw new Error(`Document does not have any pages!`)
    }

    const extractor = determineFormat(doc)
    if (extractor) {
        const dataToExtract = parseStatementPages(doc)
        return extractor(dataToExtract, userId)
    } else {
        throw new Error(`Cannot determine format for file: ${file.name}`)
    }
}