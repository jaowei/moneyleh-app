import { HTTPException } from "hono/http-exception";
import * as mupdf from "mupdf";
import type { Companies } from "../../db/company.seed.ts";
import { chocolate } from "./formats/chocolate.ts";
import { citiCard } from "./formats/citi.ts";
import { cpf } from "./formats/cpf.ts";
import { dbsAccount, dbsCard } from "./formats/dbs.ts";
import { gxsAccount } from "./formats/gxs.ts";
import { scbCard } from "./formats/scb.ts";
import { trustCard } from "./formats/trust.ts";
import { uobAccount, uobCard } from "./formats/uob.ts";
import {
	type MuPdfStructuredTextPage,
	MuPdfStructuredTextPageZ,
	type PdfFormatExtractor,
	type PdfParser,
} from "./pdf.type.ts";

const parseStatementPages = (document: mupdf.Document) => {
	const dataToExtract: MuPdfStructuredTextPage[] = [];
	for (let i = 0; i < document.countPages(); i++) {
		const page = document.loadPage(i);
		const convertedText = page.toStructuredText("preserve-spans").asJSON();
		try {
			const blockData = JSON.parse(convertedText);
			const parsedData = MuPdfStructuredTextPageZ.parse(blockData);
			dataToExtract.push(parsedData);
		} catch (e) {
			throw new Error(`Error converting page text: ${JSON.stringify(e)}`);
		}
	}
	return dataToExtract;
};

const getDataExtractorForFormat = (
	doc: mupdf.Document,
): { extractor: PdfFormatExtractor; companyName: Companies } => {
	const firstPage = doc.loadPage(0);
	if (firstPage.search(dbsCard.searchString).length) {
		return { extractor: dbsCard.extractData, companyName: "DBS" };
	} else if (dbsAccount.searchFn?.(firstPage)) {
		return { extractor: dbsAccount.extractData, companyName: "DBS" };
	} else if (firstPage.search(cpf.searchString).length) {
		return { extractor: cpf.extractData, companyName: "CPF" };
	} else if (firstPage.search(chocolate.searchString).length) {
		return {
			extractor: chocolate.extractData,
			companyName: "Chocolate Finance",
		};
	} else if (uobCard.searchFn?.(firstPage)) {
		return { extractor: uobCard.extractData, companyName: "UOB" };
	} else if (uobAccount.searchFn?.(firstPage)) {
		return { extractor: uobAccount.extractData, companyName: "UOB" };
	} else if (firstPage.search(trustCard.searchString).length) {
		return { extractor: trustCard.extractData, companyName: "Trust Bank" };
	} else if (firstPage.search(scbCard.searchString).length) {
		return {
			extractor: scbCard.extractData,
			companyName: "Standard Chartered",
		};
	} else if (firstPage.search(citiCard.searchString).length) {
		return { extractor: citiCard.extractData, companyName: "Citibank" };
	} else if (firstPage.search(gxsAccount.searchString).length) {
		return { extractor: gxsAccount.extractData, companyName: "GXS" };
	} else {
		throw new HTTPException(500, {
			message: "Unable to determine PDF statement format",
		});
	}
};

export const pdfParser: PdfParser = async (file, userId) => {
	const doc = mupdf.PDFDocument.openDocument(await file.arrayBuffer());
	if (!doc.countPages()) {
		throw new Error(`Document does not have any pages!`);
	}

	const { extractor, companyName } = getDataExtractorForFormat(doc);
	if (extractor) {
		const dataToExtract = parseStatementPages(doc);
		return { data: extractor(dataToExtract, userId), companyName };
	} else {
		throw new Error(`Cannot determine format for file: ${file.name}`);
	}
};
