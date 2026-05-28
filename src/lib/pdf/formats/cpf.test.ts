import { describe, expect, test } from "bun:test";
import { testATransaction, testUser } from "../../test.utils.ts";
import { pdfParser } from "../pdf.ts";

describe("pdf: CPF statement", () => {
	test("cpf statement", async () => {
		const file = Bun.file("./test-files/cpf.pdf");
		const buf = await file.arrayBuffer();
		const f = new File([buf], "file");
		const { data } = await pdfParser(f, testUser.id);
		if ("accounts" in data) {
			const accounts = Object.keys(data.accounts);
			expect(accounts.length).toBe(3);
			expect(data.accounts.ordinaryAccount.transactions.length).toBe(2);
			expect(data.accounts.specialAccount.transactions.length).toBe(1);
			expect(data.accounts.medisaveAccount.transactions.length).toBe(3);
			// should not have the same value as other accounts
			expect(data.accounts.specialAccount.transactions[0]).not.toBe(
				data.accounts.ordinaryAccount.transactions[1],
			);

			data.accounts.ordinaryAccount.transactions.forEach(testATransaction);
			data.accounts.specialAccount.transactions.forEach(testATransaction);
			data.accounts.medisaveAccount.transactions.forEach(testATransaction);
		} else {
			throw Error();
		}
	});
});
