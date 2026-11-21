import { describe, expect, test } from "bun:test";
import { getEntityFromParsedNames } from "./ui.utils.ts";

describe("ui.utils: getEntityFromParsedNames", () => {
	describe("linked identifiers", () => {
		test("resolves a card", async () => {
			const res = await getEntityFromParsedNames(
				"DBS ALTITUDE VISA SIGNATURE",
				"DBS",
				"card",
			);
			expect(res.found).toBe(true);
			if (res.found) {
				expect(res.entityId).toBe(1);
				expect(res.name).toBe("altitude");
				expect(res.linkId).toBe(1);
			}
		});
		test("resolves an account", async () => {
			const res = await getEntityFromParsedNames(
				"My Account",
				"DBS",
				"account",
			);
			expect(res.found).toBe(true);
			if (res.found) {
				expect(res.entityId).toBe(2);
				expect(res.name).toBe("my account");
				expect(res.linkId).toBe(8);
			}
		});
		test("resolves a broker account", async () => {
			const res = await getEntityFromParsedNames(
				"chocolateManagedAccount",
				"Chocolate Finance",
				"account",
			);
			expect(res.found).toBe(true);
			if (res.found) {
				expect(res.entityId).toBe(15);
				expect(res.name).toBe("chocolate managed account");
				expect(res.linkId).toBe(16);
			}
		});
		test("identifier lookup is case insensitive", async () => {
			const res = await getEntityFromParsedNames(
				"my account",
				"DBS",
				"account",
			);
			expect(res.found).toBe(true);
		});
		test("throws when the identifier is linked to another entity type", async () => {
			expect(
				getEntityFromParsedNames("My Account", "DBS", "card"),
			).rejects.toThrow("is not linked to a card");
		});
	});

	describe("unlinked identifiers", () => {
		test("returns only accounts of the parsed company", async () => {
			const res = await getEntityFromParsedNames(
				"some unknown account",
				"Chocolate Finance",
				"account",
			);
			expect(res.found).toBe(false);
			if (res.found === false) {
				// Other test files may create accounts for this company in
				// parallel, so only assert on the seeded account and the scoping.
				expect(res.availableEntities.length).toBeGreaterThanOrEqual(1);
				expect(
					res.availableEntities.every(
						(entity) => entity.companyName === "Chocolate Finance",
					),
				).toBe(true);
				expect(
					res.availableEntities.some(
						(entity) =>
							entity.id === 15 && entity.name === "chocolate managed account",
					),
				).toBe(true);
			}
		});
		test("returns only cards of the parsed company", async () => {
			const res = await getEntityFromParsedNames(
				"some unknown card",
				"DBS",
				"card",
			);
			expect(res.found).toBe(false);
			if (res.found === false) {
				expect(res.availableEntities.length).toBeGreaterThanOrEqual(3);
				expect(
					res.availableEntities.every((entity) => entity.companyName === "DBS"),
				).toBe(true);
			}
		});
		test("returns no accounts for a company without accounts", async () => {
			const res = await getEntityFromParsedNames(
				"some unknown account",
				"Standard Chartered",
				"account",
			);
			expect(res.found).toBe(false);
			if (res.found === false) {
				expect(res.availableEntities).toBeArrayOfSize(0);
			}
		});
	});
});
