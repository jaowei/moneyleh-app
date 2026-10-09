import type { EditableCellType } from "../components/EditableCell.ts";
import { toIsoDate } from "./date-utils.ts";

/** The subset of a transaction that every transaction table lets a user edit. */
export interface EditableTransaction {
	transactionDate: string;
	description: string;
	currency: string;
	amount: number;
}

export type EditableTransactionField = keyof EditableTransaction;

/**
 * Which cell editor each transaction field uses. Adding a field here is enough
 * to make it editable in every table built on `EditableCell`.
 */
export const editableFieldTypes = {
	transactionDate: "date",
	description: "text",
	currency: "text",
	amount: "number",
} as const satisfies Record<EditableTransactionField, EditableCellType>;

export const editableFields = Object.keys(
	editableFieldTypes,
) as EditableTransactionField[];

export const isEditableTransactionField = (
	field: string,
): field is EditableTransactionField =>
	Object.hasOwn(editableFieldTypes, field);

/**
 * Applies the raw string an `<input>` gives us to a transaction field.
 *
 * Unparseable values (an incomplete or impossible date, a half-typed amount)
 * are dropped so the previous value is kept instead of persisting junk.
 */
export const updateEditableField = <T extends EditableTransaction>(
	transaction: T,
	field: EditableTransactionField,
	rawValue: string,
): T => {
	switch (field) {
		case "transactionDate": {
			const transactionDate = toIsoDate(rawValue);
			return transactionDate
				? { ...transaction, transactionDate }
				: transaction;
		}
		case "amount": {
			// Number("") is 0, which would silently zero the transaction
			// whenever the amount field is momentarily empty mid-edit.
			if (rawValue.trim() === "") {
				return transaction;
			}
			const amount = Number(rawValue);
			return Number.isFinite(amount) ? { ...transaction, amount } : transaction;
		}
		case "description":
			return { ...transaction, description: rawValue };
		case "currency":
			return { ...transaction, currency: rawValue };
	}
};
