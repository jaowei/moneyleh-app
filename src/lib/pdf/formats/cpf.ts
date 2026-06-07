import type { TransactionsInsertSchema } from "../../../db/schema.ts";
import { ParsingErrors } from "../../../errors.ts";
import { parseDateString } from "../../dayjs.ts";
import { appLogger } from "../../logger.ts";
import type {
	CPFStatementData,
	MuPdfStructuredTextBlock,
	PdfFormat,
	PdfFormatExtractor,
} from "../pdf.type.ts";
import { parseTxnDate } from "../pdf.utils.ts";

const parseAmount = (amountLine: string) => {
	const clean = amountLine.replaceAll(",", "");
	try {
		return parseFloat(clean);
	} catch {
		throw ParsingErrors.transactionAmt;
	}
};

const parseTxn = (account: string, amountStr?: string) => {
	if (!amountStr) {
		appLogger(`WARN: Could not get ${account} amount`);
		return 0;
	}
	const parsed = parseAmount(amountStr);
	if (parsed === undefined) {
		appLogger(`WARN: Could not parse transaction amount for ${account}`);
		return 0;
	} else if (parsed) {
		return parsed;
	} else {
		// no transaction as the amount is 0
		return 0;
	}
};

const getStatementDate = (blocks: MuPdfStructuredTextBlock[]) => {
	const dateBlockIdx = blocks.findIndex((block) =>
		block.lines.find((line) => line.text === "Transaction history"),
	);
	const dateBlock = blocks.at(dateBlockIdx);
	if (!dateBlock) {
		throw ParsingErrors.statementDate;
	}
	let statementPeriod = dateBlock.lines[1]?.text;
	if (!statementPeriod) {
		// dates are not in the same block, should be in next block
		const nextBlock = blocks.at(dateBlockIdx + 1);
		const value = nextBlock?.lines[0]?.text;
		if (!value) {
			appLogger("WARN: Date block has shifted format may have been edited");
			throw ParsingErrors.statementDate;
		}
		statementPeriod = value;
	}
	const matches = statementPeriod?.match(/\d{2} \w{3} \d{4}/);
	if (matches?.[0]) {
		const parsed = parseDateString(matches[0], "DD MMM YYYY");
		if (!parsed) {
			throw ParsingErrors.statementDate;
		}
		return parsed;
	} else {
		throw ParsingErrors.statementDate;
	}
};

const getAbbrMap = (blocks: MuPdfStructuredTextBlock[]) => {
	const abbrMap = new Map<string, string>();
	blocks.forEach((block) => {
		const abbrMatch = block.lines[0]?.text.match(/[A-Z]{3}/);
		if (abbrMatch?.[0]) {
			abbrMap.set(
				abbrMatch[0],
				block.lines
					.slice(1)
					.map((l) => l.text)
					.join(" "),
			);
		}
	});
	return abbrMap;
};

const extractData: PdfFormatExtractor = (dataToExtract, userId) => {
	const statementData: CPFStatementData = {
		type: "cpf",
		statementDate: "",
		accounts: {
			ordinaryAccount: { transactions: [] },
			specialAccount: { transactions: [] },
			medisaveAccount: { transactions: [] },
		},
	};
	if (!dataToExtract[0]) {
		throw ParsingErrors.page;
	}
	const firstPageBlocks = dataToExtract[0].blocks;
	statementData.statementDate = getStatementDate(firstPageBlocks);
	const remainingPages = dataToExtract.slice(1).flatMap((page) => page.blocks);
	const abbrMap = getAbbrMap(remainingPages);
	dataToExtract.forEach((page) => {
		const { blocks } = page;
		blocks.forEach((block) => {
			const startingLine = block.lines[0];
			if (!startingLine) return;

			if (block.lines.length >= 5) {
				const txnDate = parseTxnDate(
					startingLine.text,
					statementData.statementDate,
				);
				if (txnDate) {
					if (block.lines[1]?.text.toLowerCase() === "bal") return;
					const oaAmt = parseTxn("OA", block.lines.at(-3)?.text);
					const saAmt = parseTxn("SA", block.lines.at(-2)?.text);
					const maAmt = parseTxn("MA", block.lines.at(-1)?.text);
					const transaction: Omit<TransactionsInsertSchema, "amount"> = {
						transactionDate: txnDate,
						currency: "SGD",
						description: block.lines
							.slice(1, block.lines.length - 3)
							.map((l) => l.text)
							.join(" "),
						userId,
					};
					if (oaAmt) {
						statementData.accounts.ordinaryAccount.transactions.push({
							...transaction,
							amount: oaAmt,
						});
					}
					if (saAmt) {
						statementData.accounts.specialAccount.transactions.push({
							...transaction,
							amount: saAmt,
						});
					}
					if (maAmt) {
						statementData.accounts.medisaveAccount.transactions.push({
							...transaction,
							amount: maAmt,
						});
					}
				}
			}
		});
	});

	Object.values(statementData.accounts).forEach((a) => {
		a.transactions.forEach((t) => {
			const code = t.description?.slice(0, 3) || "";
			const fullDesc = abbrMap.get(code);
			if (fullDesc && t.description) {
				t.description += ` ${fullDesc}`;
			}
		});
	});
	return statementData;
};

export const cpf: PdfFormat = {
	searchString: "CPF",
	extractData,
};
