import { describe, expect, test } from "bun:test";
import {
	editableFields,
	editableFieldTypes,
	isEditableTransactionField,
	updateEditableField,
} from "./editable-fields.ts";

const transaction = {
	transactionDate: "2024-01-15T00:00:00.000Z",
	description: "NTUC FAIRPRICE",
	currency: "SGD",
	amount: 42.5,
	tags: [],
	id: 7,
};

describe("editable-fields", () => {
	describe("editableFieldTypes", () => {
		test("covers the transaction fields users can edit", () => {
			expect(editableFields).toEqual([
				"transactionDate",
				"description",
				"currency",
				"amount",
			]);
		});

		test("gives every field a cell type", () => {
			for (const field of editableFields) {
				expect(editableFieldTypes[field]).toMatch(/^(text|number|date)$/);
			}
		});
	});

	describe("isEditableTransactionField", () => {
		test("recognises known fields", () => {
			expect(isEditableTransactionField("transactionDate")).toBe(true);
			expect(isEditableTransactionField("amount")).toBe(true);
		});

		test("rejects unknown fields", () => {
			expect(isEditableTransactionField("userId")).toBe(false);
			expect(isEditableTransactionField("")).toBe(false);
			expect(isEditableTransactionField("toString")).toBe(false);
		});
	});

	describe("updateEditableField", () => {
		test("stores dates as ISO, not as the raw input", () => {
			const updated = updateEditableField(
				transaction,
				"transactionDate",
				"2024-03-01",
			);
			expect(updated.transactionDate).toBe("2024-03-01T00:00:00.000Z");
		});

		test("keeps the previous date when the input is not a real day", () => {
			expect(
				updateEditableField(transaction, "transactionDate", "2023-02-29")
					.transactionDate,
			).toBe(transaction.transactionDate);
			expect(
				updateEditableField(transaction, "transactionDate", "").transactionDate,
			).toBe(transaction.transactionDate);
		});

		test("updates descriptions and currency verbatim", () => {
			expect(
				updateEditableField(transaction, "description", "AMAZON").description,
			).toBe("AMAZON");
			expect(updateEditableField(transaction, "currency", "USD").currency).toBe(
				"USD",
			);
		});

		test("parses amounts as numbers", () => {
			expect(updateEditableField(transaction, "amount", "12.34").amount).toBe(
				12.34,
			);
			expect(updateEditableField(transaction, "amount", "-8").amount).toBe(-8);
			expect(updateEditableField(transaction, "amount", "0").amount).toBe(0);
		});

		test("keeps the previous amount while it cannot be parsed", () => {
			expect(updateEditableField(transaction, "amount", "").amount).toBe(42.5);
			expect(updateEditableField(transaction, "amount", "abc").amount).toBe(
				42.5,
			);
			expect(
				updateEditableField(transaction, "amount", "Infinity").amount,
			).toBe(42.5);
		});

		test("does not mutate the transaction it is given", () => {
			const original = { ...transaction };
			updateEditableField(transaction, "description", "CHANGED");
			updateEditableField(transaction, "amount", "999");
			expect(transaction).toEqual(original);
		});

		test("preserves fields outside the editable set", () => {
			const updated = updateEditableField(transaction, "description", "AMAZON");
			expect(updated.id).toBe(7);
			expect(updated.tags).toBe(transaction.tags);
		});
	});
});
