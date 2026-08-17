import { ParsingErrors } from "../../../errors.ts";
import { parseDateString } from "../../dayjs.ts";
import { appLogger } from "../../logger.ts";
import type {
	AccountStatementData,
	CardStatementData,
	MuPdfStructuredLine,
	MuPdfStructuredTextBlock,
	PdfFormat,
	PdfFormatExtractor,
	PointsData,
} from "../pdf.type.ts";
import { parseTxnDate } from "../pdf.utils.ts";

const getStatementDateCard = (blocks: MuPdfStructuredTextBlock[]) => {
	const statementDataTableHeaderIdx = blocks.findIndex((block) =>
		block.lines.find((line) => line.text.toLowerCase() === "statement date"),
	);
	const dateBlock = blocks[statementDataTableHeaderIdx + 1];
	if (!dateBlock?.lines[0]) {
		throw ParsingErrors.statementDate;
	}
	const parsed = parseDateString(dateBlock.lines[0].text, "DD MMM YYYY");
	if (parsed) {
		return parsed;
	} else {
		throw ParsingErrors.statementDate;
	}
};

const getCreditLimitCard = (blocks: MuPdfStructuredTextBlock[]) => {
	const statementDataTableHeaderIdx = blocks.findIndex((block) =>
		block.lines.find((line) => line.text.toLowerCase() === "statement date"),
	);
	const creditLimitBlock = blocks[statementDataTableHeaderIdx + 1];
	if (!creditLimitBlock?.lines[1]) {
		throw ParsingErrors.statementDate;
	}
	if (creditLimitBlock.lines[1].text.startsWith("$")) {
		try {
			const cleanValue = creditLimitBlock.lines[1].text
				.replaceAll(",", "")
				.replaceAll("$", "");
			return parseInt(cleanValue, 10);
		} catch (e) {
			appLogger(`WARN: Credit limit parsing error: ${e}`);
			throw ParsingErrors.creditLimit;
		}
	}
};

const getDueDateCard = (blocks: MuPdfStructuredTextBlock[]) => {
	const statementDataTableHeaderIdx = blocks.findIndex((block) =>
		block.lines.find((line) => line.text.toLowerCase() === "statement date"),
	);
	const dueDateBlock = blocks[statementDataTableHeaderIdx + 1];
	if (!dueDateBlock?.lines[3]) {
		throw ParsingErrors.statementDate;
	}
	const parsed = parseDateString(dueDateBlock.lines[3].text, "DD MMM YYYY");
	if (parsed) {
		return parsed;
	} else {
		throw ParsingErrors.dueDate;
	}
};

const getCurrency = (blocks: MuPdfStructuredTextBlock[]) => {
	const transactionsHeaderBlock = blocks.find((block) =>
		block.lines.find((line) => line.text.toLowerCase() === "date"),
	);
	if (transactionsHeaderBlock?.lines[2]?.text.toLowerCase().includes("s$")) {
		return "SGD";
	} else {
		appLogger(`WARN: No currency detected!`);
	}
};

const processPointsSummary = (blocks: MuPdfStructuredTextBlock[]) => {
	const pointSummaryTableHeaderIdx = blocks.findIndex((block) =>
		block.lines.find((line) =>
			line.text.toLowerCase().includes("points summary"),
		),
	);
	if (pointSummaryTableHeaderIdx < 0) {
		throw ParsingErrors.points;
	}
	const pointsStartIdx = pointSummaryTableHeaderIdx + 5;
	const pointSummaryTableEndIdx = blocks.findIndex(
		(block, idx) =>
			idx > pointsStartIdx &&
			block.lines.find((line) => line.text.toLowerCase() === "total"),
	);
	const data: Record<string, PointsData> = {};
	blocks.slice(pointsStartIdx, pointSummaryTableEndIdx).forEach((block) => {
		const { cardNum, ...rest } = extractPointsDataCard(block);
		data[cardNum] = { ...rest };
	});
	return data;
};

const parsePointsSummaryLineCard = (pointLine?: MuPdfStructuredLine) => {
	const value = pointLine?.text?.replaceAll(",", "");
	if (!value) return 0;

	if (value.toLowerCase().includes("no expiry")) {
		return 0;
	}
	return parseInt(value, 10);
};

const extractPointsDataCard = (block: MuPdfStructuredTextBlock) => {
	if (!block.lines[0]) {
		appLogger(`WARN: Card number does not exist on point summary`);
	}
	return {
		cardNum: block.lines[0]?.text || "",
		startBalance: parsePointsSummaryLineCard(block.lines[1]),
		earned: parsePointsSummaryLineCard(block.lines[2]),
		redeemed: parsePointsSummaryLineCard(block.lines[3]),
		endBalance: parsePointsSummaryLineCard(block.lines[4]),
		expiring: parsePointsSummaryLineCard(block.lines[5]),
	};
};

const parseAmountCard = (amountLine: MuPdfStructuredLine) => {
	const clean = amountLine.text.replaceAll(",", "");
	let sign = -1;
	if (clean.includes("CR")) {
		sign = 1;
	}
	try {
		return parseFloat(clean) * sign;
	} catch (e) {
		appLogger(`WARN: Unable to parse transaction amount`);
	}
};
const processTransactions = (
	blocks: MuPdfStructuredTextBlock[],
	currency: string,
	userId: string,
	statementDate: string,
) => {
	const data: CardStatementData["cards"] = {};
	let currentCardName = "";
	let cardTxnIdx = -1;
	for (const [currIdx, block] of blocks.entries()) {
		const startingLineText = block.lines.at(0);
		if (!startingLineText) continue;
		const matchRes = startingLineText.text.match(
			/(.+) CARD NO\.: ([0-9]{4} [0-9]{4} [0-9]{4} [0-9]{4})/,
		);
		if (matchRes?.length) {
			appLogger(`Card found! (${matchRes[1]})`);
			const cardName = matchRes[1];
			const cardNumber = matchRes[2];
			if (cardName && cardNumber) {
				currentCardName = cardName;
				data[cardName] = {
					transactions: [],
					total: 0,
					cardNumber,
				};
				cardTxnIdx = currIdx + 1;
			} else {
				appLogger(`WARN: Card name could not be found`);
			}
		}
		if (currIdx > cardTxnIdx && cardTxnIdx > 0) {
			if (block.lines[0]?.text.includes("SUB-TOTAL:")) {
				const cardData = data[currentCardName];
				// TODO: Figure out how to check for discrepancy rather than taking the statement value
				// have to match even with the credit card payment transaction line
				if (cardData && block.lines[1]) {
					cardData.total = parseAmountCard(block.lines[1]) || 0;
				}
				continue;
			} else if (block.lines[0]?.text.toLowerCase() === "total:") {
				appLogger(`End of card transactions!`);
				cardTxnIdx = -1;
				continue;
			}
			const transaction = {
				transactionDate: "",
				description: "",
				amount: Number.NaN,
				currency,
				userId,
			};
			let descStartIdx = 1;
			if (block.lines[0]) {
				let txnDate = block.lines[0].text;
				if (
					block.lines[0].text.includes("NEW TRANSACTIONS") &&
					block.lines[1]
				) {
					appLogger(
						`Starting of transactions list for card (${currentCardName})`,
					);
					txnDate = block.lines[1].text;
					descStartIdx += 1;
				}
				const parsedDate = parseTxnDate(txnDate, statementDate);
				if (parsedDate) {
					transaction.transactionDate = parsedDate;
				} else {
					continue;
				}
			} else {
				appLogger(`WARN: Invalid transaction block, has no lines`);
			}

			// Handles the bill payment transaction line that is split into 2 blocks
			// this occurrs before the list of transactions
			const secondLast = block.lines.at(-2)?.x || 0;
			const xCoordDiff = block.lines.at(-1)?.x || 0 - secondLast;
			if (xCoordDiff < 100) {
				transaction.description = block.lines
					.slice(descStartIdx)
					.map((line) => line.text)
					.join(" ");
				const amountLine = blocks[currIdx + 1]?.lines[0];
				console.log(amountLine?.text);
				if (amountLine) {
					transaction.amount = parseAmountCard(amountLine) || 0;
				} else {
					appLogger(`WARN: Bill payment transaction block, has no lines`);
				}
			} else {
				transaction.description = block.lines
					.slice(descStartIdx, block.lines.length - 1)
					.map((line) => line.text)
					.join(" ");

				const amountLine = block.lines.at(-1);
				if (amountLine) {
					transaction.amount = parseAmountCard(amountLine) || 0;
				} else {
					appLogger(`WARN: Amount block could not be detected`);
				}
			}

			const cardData = data[currentCardName];
			if (cardData) {
				cardData.transactions.push(transaction);
			} else {
				appLogger(`WARN: Could not find card transactions store`);
			}
		}
	}
	return data;
};

const extractDataCard: PdfFormatExtractor = (dataToExtract, userId) => {
	const data: CardStatementData = {
		type: "card",
		statementDate: "",
		dueDate: "",
		creditLimit: -1,
		cards: {},
		points: {},
	};
	let currency: string = "";
	const firstPage = dataToExtract.at(0);
	if (!firstPage) {
		throw ParsingErrors.page;
	}
	data.statementDate = getStatementDateCard(firstPage.blocks);
	data.creditLimit = getCreditLimitCard(firstPage.blocks);
	data.dueDate = getDueDateCard(firstPage.blocks);
	currency = getCurrency(firstPage.blocks) || "SGD";

	const allPages = dataToExtract.flatMap((page) => page.blocks);
	data.points = processPointsSummary(allPages);
	data.cards = processTransactions(
		allPages,
		currency,
		userId,
		data.statementDate,
	);

	return data;
};

const parseAmountAccount = (
	line: MuPdfStructuredLine,
	isWithdrawal: boolean,
	blockIdx: number,
) => {
	const cleanAmt = line.text.trim().replaceAll(",", "");
	try {
		return isWithdrawal ? -1 * parseFloat(cleanAmt) : parseFloat(cleanAmt);
	} catch {
		appLogger(`ERROR: Error parsing amount block ${blockIdx}`);
		return undefined;
	}
};

const extractDataAccount: PdfFormatExtractor = (dataToExtract, userId) => {
	let pageNum = 0;
	const dataIdx = {
		transactionsDetails: -1,
		transactions: -1,
	};
	const extractedData: AccountStatementData = {
		type: "account",
		statementDate: "",
		accounts: {},
	};
	let currentCurrency = "SGD";
	let currentAccount: string | undefined;
	for (const data of dataToExtract) {
		pageNum++;
		const { blocks } = data;
		blocks.forEach((block, blockIdx) => {
			const firstLineOfBlock = block.lines[0];

			if (!firstLineOfBlock) return;

			if (firstLineOfBlock.text.toLowerCase() === "account summary") {
				const dateLine = block.lines[1];
				if (dateLine) {
					extractedData.statementDate =
						parseDateString(dateLine.text.slice(-11), "DD MMM YYYY") || "";
				} else {
					appLogger(`WARN: could not get statement date`);
				}
			}

			// transaction details pages
			const lastLineOfBlock = block.lines.at(-1);
			if (!lastLineOfBlock) return;

			if (firstLineOfBlock.text.includes("Balance Brought Forward")) {
				// SRS accounts do not have currency in this line
				if (lastLineOfBlock.text.length > 5) {
					currentCurrency = lastLineOfBlock.text.slice(0, 3);
				}
				dataIdx.transactions = blockIdx + 1;
			} else if (firstLineOfBlock.text.includes("Balance Carried Forward")) {
				dataIdx.transactions = -1;
			} else {
				const accountNumMatch =
					lastLineOfBlock.text.match(/(Account No.) (.*)/);
				if (accountNumMatch) {
					const accountName = firstLineOfBlock.text;
					const accountNumber = accountNumMatch[2];
					if (
						accountNumber &&
						!extractedData.accounts[accountName]?.accountNumber
					) {
						currentAccount = accountName;
						extractedData.accounts[accountName] = {
							transactions: [],
							accountNumber,
						};
					}
				}
			}

			// collect transactions per account
			if (currentAccount && blockIdx >= dataIdx.transactions) {
				if (!extractedData.accounts[currentAccount]?.accountNumber) {
					appLogger(`WARN account was not found but collecting transactions`);
				}

				// parse date
				const transactionDate = parseDateString(
					firstLineOfBlock.text,
					"DD/MM/YYYY",
				);
				// the current block contains amount only skip to the next block
				if (!transactionDate) {
					return;
				}

				// parse amount
				const potentialAmountOnSameBlock = block.lines[2];
				const coordThresholdForWithdrawal = 420;
				let amount = 0;
				let description = "";

				if (potentialAmountOnSameBlock) {
					const isWithdrawal =
						potentialAmountOnSameBlock.bbox.x < coordThresholdForWithdrawal;
					const amountOnSameBlock = parseAmountAccount(
						potentialAmountOnSameBlock,
						isWithdrawal,
						blockIdx,
					);
					if (amountOnSameBlock) {
						amount = amountOnSameBlock;
						description = block.lines[1]?.text || "";
					} else {
						const nextBlock = blocks[blockIdx + 1];
						const amountLineOnNextBlock = nextBlock?.lines[0];
						if (nextBlock && amountLineOnNextBlock) {
							const isWithdrawal =
								nextBlock.bbox.x < coordThresholdForWithdrawal;
							const amountOnNextBlock = parseAmountAccount(
								amountLineOnNextBlock,
								isWithdrawal,
								blockIdx + 1,
							);
							if (amountOnNextBlock) {
								amount = amountOnNextBlock;
							}
							description = block.lines
								.slice(1)
								.map((l) => l.text)
								.join(" ");
						}
					}
				}

				extractedData.accounts[currentAccount]?.transactions.push({
					transactionDate,
					currency: currentCurrency,
					amount,
					userId,
					description,
				});
			}
		});
	}

	return extractedData;
};

export const dbsCard: PdfFormat = {
	searchString: "DBS Cards",
	extractData: extractDataCard,
};
export const dbsAccount: PdfFormat = {
	searchString: "Consolidated Statement",
	searchFn: (page) => {
		const statementName = page.search("Consolidated Statement").length;
		const companyName1 = page.search("DBS Co.").length;
		const companyName2 = page.search("POSB Biz").length;
		return !!statementName && !!companyName1 && !!companyName2;
	},
	extractData: extractDataAccount,
};
