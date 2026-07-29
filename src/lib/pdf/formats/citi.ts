import { ParsingErrors } from "../../../errors";
import { extendedDayjs, parseDateString } from "../../dayjs";
import type {
	CardStatementData,
	MuPdfStructuredTextBlock,
	PdfFormat,
	PdfFormatExtractor,
	StatementData,
} from "../pdf.type";
import { parseTxnDate } from "../pdf.utils";

type ProcessedPdfBlockCiti = MuPdfStructuredTextBlock & { text: string };

// for statement/due dates in summary, header
const parseCitiStatementDate = (dateToParse: string) => {
	return parseDateString(dateToParse, "MMMM DD, YYYY");
};

const getDateFromSummary = (
	processed: ProcessedPdfBlockCiti[],
	searchText: "Statement Date" | "Payment Due Date",
) => {
	const dateBlock = processed.find(
		(block) => block.text.includes(searchText) && block.text.length < 35,
	);

	const dateToParse = dateBlock?.text.replace(searchText, "").trim();
	if (!dateToParse) {
		if (searchText === "Statement Date") {
			throw ParsingErrors.statementDate;
		}
		throw ParsingErrors.dueDate;
	}
	const parsedDate = parseCitiStatementDate(dateToParse);
	if (!parsedDate) {
		if (searchText === "Statement Date") {
			throw ParsingErrors.statementDate;
		}
		throw ParsingErrors.dueDate;
	}
	return parsedDate;
};

const getCreditLimit = (processed: ProcessedPdfBlockCiti[]) => {
	const searchText = "Credit Limit";
	const creditLimitBlock = processed.find((block) =>
		block.text.includes(searchText),
	);
	const limitToParse = creditLimitBlock?.text.replace(searchText, "").trim();
	if (!limitToParse) {
		throw ParsingErrors.creditLimit;
	}
	try {
		return parseFloat(limitToParse.replace("$", "").replace(",", ""));
	} catch {
		throw ParsingErrors.creditLimit;
	}
};

const getCardDetails = (processed: ProcessedPdfBlockCiti[]) => {
	const headerEndIdx = processed.findIndex((block) =>
		block.text.includes("TOTAL POINTSAVAILABLE"),
	);
	const tableEndIdx = processed.findIndex((block) =>
		block.text.includes("PAYMENT SLIP"),
	);
	if (headerEndIdx < 0 || tableEndIdx < 0) {
		throw ParsingErrors.cardDetails;
	}
	const cardDetails: CardStatementData["cards"] = {};
	const cardPointsDetails: CardStatementData["points"] = {};
	processed.slice(headerEndIdx + 1, tableEndIdx).forEach((block) => {
		const matches = block.text.match(
			/([a-zA-Z\s]*)([\d,]*.\d{2})[\d.]*[a-zA-Z\s]*([\d,]*)/,
		);
		if (!matches?.[1] || !matches[2] || !matches[3]) {
			throw ParsingErrors.cardDetails;
		}
		try {
			const cardName = matches[1];
			const cardTotalDue = parseFloat(
				matches[2].replace("$", "").replace(",", ""),
			);
			const cardPoints = parseInt(matches[3].replace(",", ""), 10);
			cardDetails[cardName] = {
				transactions: [],
				total: cardTotalDue,
				cardNumber: "",
			};
			cardPointsDetails[cardName] = {
				startBalance: 0,
				earned: 0,
				redeemed: 0,
				expiring: 0,
				endBalance: cardPoints,
			};
		} catch {
			throw ParsingErrors.cardDetails;
		}
	});

	const paymentTableStartIdx = processed.findIndex((block) =>
		block.text.includes("CREDIT CARD TYPE"),
	);
	const paymentTableText = processed
		.slice(paymentTableStartIdx)
		.map((b) => b.text);
	Object.keys(cardDetails).forEach((cardName) => {
		const details = paymentTableText.find((t) =>
			t.replaceAll(" ", "").includes(cardName.replaceAll(" ", "")),
		);
		const cardNumber = details?.match(/\d{16}/);
		if (cardNumber && cardDetails[cardName]) {
			cardDetails[cardName].cardNumber = cardNumber[0];
		}
	});
	return { cardDetails, cardPointsDetails };
};

const walkLines = (block: ProcessedPdfBlockCiti, xCoordThreshold = 35) => {
	const results = [];
	let prevX = block.bbox.x; // start of the block, should match first line x coord
	let accm = "";
	for (const [idx, line] of block.lines.entries()) {
		const currDiff = line.x - prevX;
		if (currDiff > xCoordThreshold) {
			results.push(accm);
			accm = line.text;
		} else if (idx === block.lines.length - 1) {
			results.push(accm + line.text);
		} else {
			accm += line.text;
		}
		prevX = line.x;
	}
	return results;
};

const processCardTransactions = (
	blocks: ProcessedPdfBlockCiti[],
	cardDetails: CardStatementData["cards"],
	statementDate: string,
	userId: string,
) => {
	const currency = "SGD";

	const splitBlockToTxn = (block: ProcessedPdfBlockCiti) => {
		const txn = walkLines(block);

		try {
			const desc = txn.slice(1, txn.length - 1).join(" ") || "";
			let amount = 0;
			const amountItem = txn.at(-1);
			if (amountItem) {
				const sign = amountItem.includes("(") ? 1 : -1;
				const cleanStr = amountItem
					.replace(",", "")
					.replace("(", "")
					.replace(")", "");
				amount = parseFloat(cleanStr) * sign;
			}
			return {
				desc,
				amount,
			};
		} catch {
			throw ParsingErrors.transactionAmt;
		}
	};

	Object.keys(cardDetails).forEach((cardName) => {
		const startIdx = blocks.findIndex((block) =>
			block.text.includes(`TRANSACTIONS FOR ${cardName}`),
		);
		if (startIdx < 0) return;
		const endIdx = blocks.findIndex(
			(block, idx) => block.text.includes("GRAND TOTAL") && idx > startIdx,
		);
		if (endIdx < 0) return;
		const txns = blocks.slice(startIdx + 1, endIdx).reduce(
			(prev, block) => {
				const txnDate = parseTxnDate(block.text.slice(0, 6), statementDate);
				if (!txnDate) return prev;
				const { desc, amount } = splitBlockToTxn(block);
				prev.push({
					transactionDate: txnDate,
					description: desc,
					currency,
					amount,
					userId,
				});
				return prev;
			},
			[] as CardStatementData["cards"][0]["transactions"],
		);

		if (cardDetails[cardName]) {
			cardDetails[cardName].transactions = txns;
		}
	});
};

const processCardPoints = (
	blocks: ProcessedPdfBlockCiti[],
	pointsDetails: CardStatementData["points"],
) => {
	const pointsStartIdx = blocks.findIndex((block) =>
		block.text.includes("YOUR CITI THANKYOU POINTS"),
	);
	const pointsEndIdx = blocks.findIndex(
		(block, idx) =>
			block.text.includes("TOTALAVAILABLE") && idx > pointsStartIdx,
	);
	const pointsBlock = blocks.at(pointsEndIdx + 1);
	if (!pointsBlock) throw ParsingErrors.points;
	// const points = walkLines(pointsBlock)
	// TODO: figure out how to match points to card
	pointsDetails;
};
const consolidateBlockLines = (
	block: MuPdfStructuredTextBlock,
): ProcessedPdfBlockCiti => {
	const text = block.lines
		.map((line) => line.text)
		.join("")
		.trim();
	return {
		...block,
		text,
	};
};

const extractDataCard: PdfFormatExtractor = (dataToExtract, userId) => {
	const extractedData: StatementData = {
		type: "card",
		dueDate: "",
		statementDate: "",
		creditLimit: 0,
		cards: {},
		points: {},
	};
	const firstPage = dataToExtract.at(0);
	if (!firstPage) {
		throw ParsingErrors.page;
	}
	const processed = firstPage.blocks.map(consolidateBlockLines);

	extractedData.statementDate = getDateFromSummary(processed, "Statement Date");
	extractedData.creditLimit = getCreditLimit(processed);
	extractedData.dueDate = getDateFromSummary(processed, "Payment Due Date");
	const { cardDetails, cardPointsDetails } = getCardDetails(processed);
	extractedData.cards = cardDetails;
	extractedData.points = cardPointsDetails;

	const remainingPages = dataToExtract
		.slice(1)
		.flatMap((data) => data.blocks.map(consolidateBlockLines));
	processCardTransactions(
		remainingPages,
		cardDetails,
		extractedData.statementDate,
		userId,
	);
	processCardPoints(remainingPages, cardPointsDetails);

	return extractedData;
};

const getCardDetailsNoHeader = (processed: ProcessedPdfBlockCiti[]) => {
	const header = processed[3];
	if (!header?.text.includes("Payment Due Date"))
		throw ParsingErrors.cardDetails;

	const matched = header.text.match(
		/([\w\s]*) (\d{4} \d{4} \d{4} \d{4})Payment Due Date: (.*)/,
	);
	const cardDetails: CardStatementData["cards"] = {};
	let dueDate = "";
	let statementDate = "";
	if (matched?.[1] && matched?.[2]) {
		cardDetails[matched[1]] = {
			transactions: [],
			total: 0,
			cardNumber: matched[2],
		};
	} else {
		throw ParsingErrors.cardDetails;
	}
	if (matched?.[3]) {
		const date = parseCitiStatementDate(matched[3]);
		if (date) {
			dueDate = date;
			statementDate = extendedDayjs(date).subtract(25, "d").utc().toISOString();
		} else {
			throw ParsingErrors.dueDate;
		}
	}
	return { cardDetails, dueDate, statementDate };
};

const extractDataCardNoHeader: PdfFormatExtractor = (dataToExtract, userId) => {
	const extractedData: StatementData = {
		type: "card",
		dueDate: "",
		statementDate: "",
		creditLimit: 0,
		cards: {},
		points: {},
	};
	const firstPage = dataToExtract.at(0);
	if (!firstPage) {
		throw ParsingErrors.page;
	}
	const processed = dataToExtract.flatMap((data) =>
		data.blocks.map(consolidateBlockLines),
	);

	const { cardDetails, dueDate, statementDate } =
		getCardDetailsNoHeader(processed);
	extractedData.cards = cardDetails;
	extractedData.dueDate = dueDate;
	extractedData.statementDate = statementDate;

	processCardTransactions(
		processed,
		cardDetails,
		extractedData.dueDate,
		userId,
	);

	return extractedData;
};

export const citiCard: PdfFormat = {
	searchString: "YOUR CITIBANK CARDS",
	extractData: extractDataCard,
};
export const citiCardNoHeader: PdfFormat = {
	searchString: "",
	searchFn: (page) => {
		const hasCompanyName = !!page.search("CITI").length;
		const hasCardSummary = !!page.search("Payments & Credits").length;
		return hasCardSummary && hasCompanyName;
	},
	extractData: extractDataCardNoHeader,
};
