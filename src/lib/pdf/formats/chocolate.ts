import dayjs from "dayjs";
import { ParsingErrors } from "../../../errors";
import { parseDateString } from "../../dayjs";
import {
	type BrokerHolding,
	type BrokerStatementData,
	brokerNames,
	type MuPdfStructuredLine,
	type MuPdfStructuredTextBlock,
	type MuPdfStructuredTextPage,
	type PdfFormat,
	type PdfFormatExtractor,
} from "../pdf.type";

const STATEMENT_DATE_FORMAT = "MMMM YYYY";
const TRANSACTION_DATE_FORMAT = "D MMM";
const TRANSACTION_ROW_LINE_COUNT = 4;
// Transactions in the "Out" column sit to the right of this x coordinate.
const MONEY_OUT_X_COORDINATE = 390;
const DEFAULT_CURRENCY = "SGD";

const CURRENCY_SYMBOLS: Record<string, string> = {
	S$: "SGD",
	US$: "USD",
	HK$: "HKD",
	A$: "AUD",
	"£": "GBP",
	"€": "EUR",
};

// Currency symbol first, then an optional sign, thousands separators and
// decimals. Anything after the number (e.g. a percentage in brackets) is
// ignored by the callers that need it.
const MONEY_PATTERN =
	/^([+-])?\s*(S\$|US\$|HK\$|A\$|\$|£|€)\s*([\d,]+(?:\.\d+)?)/;
const PERCENT_PATTERN = /([\d,]+(?:\.\d+)?)\s*%/;

const PORTFOLIO_SECTION_TITLE = "Chocolate Managed Account";
const PORTFOLIO_TOTAL_LABEL = "Month end portfolio value";
// Instrument names are printed on the left, values on the right.
const PORTFOLIO_NAME_MAX_X = 300;
const PORTFOLIO_TOTAL_TOLERANCE = 0.5;
const PORTFOLIO_LABELS = {
	units: "Units you own",
	price: "Unit price",
	allocation: "Fund allocation",
	unrealisedGain: "Unrealised gain",
} as const;
const PORTFOLIO_LABEL_SET = new Set<string>(Object.values(PORTFOLIO_LABELS));

const parseNumber = (raw?: string): number => {
	if (!raw) {
		throw ParsingErrors.portfolio;
	}
	const clean = raw.replaceAll(/[,\s]/g, "");
	const value = Number(clean);
	if (!Number.isFinite(value)) {
		throw ParsingErrors.portfolio;
	}
	return value;
};

const parseMoney = (raw?: string) => {
	const text = raw?.replaceAll(/\s+/g, "").trim();
	if (!text) {
		throw ParsingErrors.portfolio;
	}
	const match = text.match(MONEY_PATTERN);
	const amountStr = match?.[3];
	if (!match || !amountStr) {
		throw ParsingErrors.portfolio;
	}
	const sign = match[1] === "-" ? -1 : 1;
	return {
		amount: sign * parseNumber(amountStr),
		currency: CURRENCY_SYMBOLS[match[2] ?? ""] ?? DEFAULT_CURRENCY,
	};
};

const parsePercent = (raw?: string) => {
	if (!raw) {
		return undefined;
	}
	const match = raw.match(PERCENT_PATTERN);
	const valueStr = match?.[1];
	if (!valueStr) {
		return undefined;
	}
	return parseNumber(valueStr);
};

const parseUnrealisedGain = (raw?: string) => {
	if (!raw) {
		return undefined;
	}
	return {
		amount: parseMoney(raw).amount,
		pct: parsePercent(raw.match(/\([^)]*\)/)?.[0]),
	};
};

const getStatementDate = (page: MuPdfStructuredTextPage) => {
	const allLines = page.blocks.flatMap((block) => block.lines);
	let results: { year: number; statementDate: string } | undefined;
	for (const line of allLines) {
		const parsedDate = parseDateString(line.text.trim(), STATEMENT_DATE_FORMAT);
		if (parsedDate) {
			const lastDayOfMonth = dayjs(parsedDate).endOf("month");
			results = {
				year: lastDayOfMonth.year(),
				statementDate: lastDayOfMonth.toISOString(),
			};
		}
	}
	if (!results) {
		throw ParsingErrors.statementDate;
	}
	return results;
};

const getTransactions = (
	blocks: MuPdfStructuredTextBlock[],
	statementYear: number,
	userId: string,
) => {
	const startIdx = blocks.findIndex((block) =>
		block.lines.some((l) => l.text.trim() === "Your transactions"),
	);
	if (startIdx === -1) {
		throw ParsingErrors.accountTransactions;
	}

	const results: BrokerStatementData["transactions"] = [];
	for (const block of blocks.slice(startIdx + 1)) {
		if (block.lines.some((l) => l.text.trim() === PORTFOLIO_SECTION_TITLE)) {
			break;
		}
		if (block.lines.length !== TRANSACTION_ROW_LINE_COUNT) {
			continue;
		}
		const [dateLine, descriptionLine, amountLine] = block.lines;
		if (!dateLine || !descriptionLine || !amountLine) {
			continue;
		}
		const parsedDate = parseDateString(
			dateLine.text.trim(),
			TRANSACTION_DATE_FORMAT,
		);
		if (!parsedDate) {
			continue;
		}
		const { amount, currency } = parseMoney(amountLine.text);
		const isMoneyOut = amountLine.x > MONEY_OUT_X_COORDINATE;
		results.push({
			transactionDate: dayjs(parsedDate).year(statementYear).toISOString(),
			description: descriptionLine.text.trim(),
			amount: isMoneyOut ? -Math.abs(amount) : amount,
			currency,
			userId,
		});
	}
	return results;
};

const getPortfolioTotalLine = (blocks: MuPdfStructuredTextBlock[]) => {
	const totalIdx = blocks.findIndex((block) =>
		block.lines.some((l) => l.text.includes(PORTFOLIO_TOTAL_LABEL)),
	);
	if (totalIdx === -1) {
		return undefined;
	}
	const totalBlock = blocks[totalIdx];
	return totalBlock?.lines.find((l) => l.x >= PORTFOLIO_NAME_MAX_X);
};

type PortfolioDraft = {
	nameLines: string[];
	marketValueLine?: MuPdfStructuredLine;
	labels: Record<string, string>;
};

const getPortfolio = (blocks: MuPdfStructuredTextBlock[]) => {
	const startIdx = blocks.findIndex((block) =>
		block.lines.some((l) => l.text.trim() === PORTFOLIO_SECTION_TITLE),
	);
	const totalIdx = blocks.findIndex((block) =>
		block.lines.some((l) => l.text.includes(PORTFOLIO_TOTAL_LABEL)),
	);
	const totalLine = getPortfolioTotalLine(blocks);
	if (
		startIdx === -1 ||
		totalIdx === -1 ||
		totalIdx <= startIdx ||
		!totalLine
	) {
		throw ParsingErrors.portfolio;
	}

	const drafts: PortfolioDraft[] = [];
	let current: PortfolioDraft | undefined;
	for (const block of blocks.slice(startIdx + 1, totalIdx)) {
		const labelLine = block.lines[0];
		if (!labelLine) {
			continue;
		}
		const label = labelLine.text.trim();

		// Rows such as "Units you own" / "196.811" carry a label and its value
		// in the same block.
		if (block.lines.length === 2 && PORTFOLIO_LABEL_SET.has(label)) {
			if (!current) {
				throw ParsingErrors.portfolio;
			}
			current.labels[label] = block.lines[1]?.text.trim() ?? "";
			continue;
		}

		if (!labelLine.font.name.includes("Bold")) {
			continue;
		}

		// An instrument starts with a bold name block. The market value is
		// either in the same block or in a sibling block on the same row.
		const nameLines = block.lines
			.filter((l) => l.x < PORTFOLIO_NAME_MAX_X)
			.map((l) => l.text.trim())
			.filter(Boolean);
		const valueLine = block.lines.find((l) => l.x >= PORTFOLIO_NAME_MAX_X);
		if (nameLines.length > 0) {
			current = { nameLines, marketValueLine: valueLine, labels: {} };
			drafts.push(current);
		} else if (valueLine) {
			if (!current) {
				throw ParsingErrors.portfolio;
			}
			current.marketValueLine ??= valueLine;
		}
	}

	if (!drafts.length) {
		throw ParsingErrors.portfolio;
	}

	const holdings: BrokerHolding[] = drafts.map((draft) => {
		const instrumentName = draft.nameLines.join(" ").replaceAll(/\s+/g, " ");
		if (!instrumentName) {
			throw ParsingErrors.portfolio;
		}
		const { amount: marketValue, currency } = parseMoney(
			draft.marketValueLine?.text,
		);
		const gain = parseUnrealisedGain(
			draft.labels[PORTFOLIO_LABELS.unrealisedGain],
		);
		return {
			instrumentName,
			// Chocolate only distributes managed funds.
			securityType: "managedFund",
			units: parseNumber(draft.labels[PORTFOLIO_LABELS.units]),
			price: parseMoney(draft.labels[PORTFOLIO_LABELS.price]).amount,
			marketValue,
			currency,
			unrealisedGain: gain?.amount,
			unrealisedGainPct: gain?.pct,
			allocationPct: parsePercent(draft.labels[PORTFOLIO_LABELS.allocation]),
		};
	});

	return {
		holdings,
		portfolioValue: parseMoney(totalLine.text).amount,
	};
};

const assertPortfolioValueMatches = (
	holdings: BrokerHolding[],
	portfolioValue: number,
) => {
	// Only reconcile when everything is in the same currency as the total.
	const isSingleCurrency = holdings.every(
		(holding, _idx, list) => holding.currency === list[0]?.currency,
	);
	if (!isSingleCurrency) {
		return;
	}
	const summed = holdings.reduce((total, h) => total + h.marketValue, 0);
	if (Math.abs(summed - portfolioValue) > PORTFOLIO_TOTAL_TOLERANCE) {
		throw ParsingErrors.portfolio;
	}
};

const extractData: PdfFormatExtractor = (dataToExtract, userId) => {
	const data: BrokerStatementData = {
		type: "broker",
		name: brokerNames.chocolate,
		statementDate: "",
		transactions: [],
		portfolio: [],
	};
	const firstPage = dataToExtract.at(0);
	if (!firstPage) {
		throw ParsingErrors.page;
	}

	const { year, statementDate } = getStatementDate(firstPage);
	data.statementDate = statementDate;

	const remainingBlocks = dataToExtract.slice(1).flatMap((page) => page.blocks);
	data.transactions = getTransactions(remainingBlocks, year, userId);

	const { holdings, portfolioValue } = getPortfolio(remainingBlocks);
	assertPortfolioValueMatches(holdings, portfolioValue);
	data.portfolio = holdings;
	data.portfolioValue = portfolioValue;

	return data;
};

export const chocolate: PdfFormat = {
	searchString: "chocolatefinance.com",
	extractData,
};
