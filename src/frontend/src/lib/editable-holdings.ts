import type { FileUploadRes } from "./backend-clients.ts";

export type PortfolioHolding = FileUploadRes["portfolio"][0][number];

/**
 * A holding plus a client-only key. The key keeps each row's input state with
 * the row when another row is removed, and survives renaming the instrument.
 */
export interface EditableHoldingRow {
	key: string;
	holding: PortfolioHolding;
}

export type EditableHoldingField =
	| "instrumentName"
	| "units"
	| "price"
	| "marketValue"
	| "currency"
	| "unrealisedGain";

export const toEditableHoldingRows = (
	holdings: PortfolioHolding[],
): EditableHoldingRow[] =>
	holdings.map((holding, idx) => ({ key: `holding-${idx}`, holding }));

export const toHoldingPayload = (
	rows: EditableHoldingRow[],
): PortfolioHolding[] => rows.map((row) => row.holding);

/** A manually added holding still needs an instrument name to be saveable. */
export const hasIncompleteHolding = (holdings: PortfolioHolding[]) =>
	holdings.some((holding) => holding.instrumentName.trim() === "");

let blankHoldingCount = 0;

/**
 * Creates an empty row for a holding the parser missed. Currency is copied
 * from the statement so the new row matches the rest of the portfolio.
 */
export const createBlankHoldingRow = (currency = "SGD"): EditableHoldingRow => {
	blankHoldingCount += 1;
	return {
		key: `holding-new-${blankHoldingCount}`,
		holding: {
			instrumentName: "",
			units: 0,
			price: 0,
			marketValue: 0,
			currency,
		},
	};
};

const parseFinite = (rawValue: string) => {
	if (rawValue.trim() === "") {
		return undefined;
	}
	const value = Number(rawValue);
	return Number.isFinite(value) ? value : undefined;
};

/**
 * Applies the raw string an `<input>` gives us to a holding field.
 *
 * Required fields keep their previous value when the input is momentarily
 * empty or not a number, so a half-typed edit never zeroes parsed data. The
 * optional gain field is cleared when emptied.
 */
export const updateEditableHolding = (
	holding: PortfolioHolding,
	field: EditableHoldingField,
	rawValue: string,
): PortfolioHolding => {
	switch (field) {
		case "instrumentName":
		case "currency":
			// Required by the API, so an emptied field keeps the old value.
			return rawValue.trim() === ""
				? holding
				: { ...holding, [field]: rawValue };
		case "units":
		case "price":
		case "marketValue": {
			const value = parseFinite(rawValue);
			return value === undefined ? holding : { ...holding, [field]: value };
		}
		case "unrealisedGain": {
			if (rawValue.trim() === "") {
				const next = { ...holding };
				delete next.unrealisedGain;
				return next;
			}
			const value = parseFinite(rawValue);
			return value === undefined
				? holding
				: { ...holding, unrealisedGain: value };
		}
	}
};
