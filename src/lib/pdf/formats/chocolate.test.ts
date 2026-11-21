import { describe, expect, test } from "bun:test";
import dayjs from "dayjs";
import { testUser } from "../../test.utils";
import { pdfParser } from "../pdf";
import type { MuPdfStructuredTextPage } from "../pdf.type";
import { chocolate } from "./chocolate";

const makeLine = (text: string, x = 48) => ({
	wmode: 0 as const,
	bbox: { x, y: 0, w: 10, h: 10 },
	font: { name: "Poppins-Regular", size: 10 },
	x,
	y: 0,
	text,
});

const makePage = (texts: string[]): MuPdfStructuredTextPage => ({
	blocks: texts.map((text) => ({
		type: "text" as const,
		bbox: { x: 0, y: 0, w: 0, h: 0 },
		lines: [makeLine(text)],
	})),
});

describe("pdf: Chocolate finance statement", () => {
	test("parse", async () => {
		const file = Bun.file("./test-files/chocolate.pdf");
		const buf = await file.arrayBuffer();
		const f = new File([buf], "file");
		const { data } = await pdfParser(f, testUser.id);
		const dateObj = dayjs(data.statementDate);
		expect(dateObj.year()).toBe(2025);
		expect(dateObj.month()).toBe(8);
		expect(data.type).toBe("broker");
		if (data.type !== "broker") {
			throw new Error("Expected a broker statement");
		}

		const txns = data.transactions;
		expect(txns?.length).toBe(3);
		expect(txns?.[0]?.amount).toBe(-300);
		expect(txns?.[1]?.amount).toBe(300);
		expect(txns?.[2]?.amount).toBe(56.46);
		expect(txns?.every((t) => t.currency === "SGD")).toBe(true);

		const portfolio = data.portfolio;
		expect(portfolio).toBeArrayOfSize(5);
		expect(portfolio.map((item) => item.instrumentName)).toEqual([
			"Dimensional Global Short-Term Investment Grade Fixed Income Fund (DSF)",
			"UOBAM United SGD Fund (USF)",
			"Lion Global Short Duration Bond Fund (LGF)",
			"Fullerton Short Term Interest Rate Fund (FST)",
			"Nikko AM Shenton Short Term Bond Fund (NST)",
		]);

		expect(portfolio[0]).toMatchObject({
			units: 196.811,
			price: 22.17,
			marketValue: 4363.3,
			currency: "SGD",
			securityType: "managedFund",
			unrealisedGain: 68.68,
			unrealisedGainPct: 1.57,
			allocationPct: 14.88,
		});
		expect(portfolio[1]).toMatchObject({
			units: 7287.18,
			price: 1.403,
			marketValue: 10224.64,
		});
		expect(portfolio[2]).toMatchObject({
			units: 8117.59,
			price: 1.2738,
			marketValue: 10340.19,
		});
		expect(portfolio[3]).toMatchObject({
			units: 1396.336,
			price: 1.05414,
			marketValue: 1471.93,
		});
		expect(portfolio[4]).toMatchObject({
			units: 2798.61,
			price: 1.04,
			marketValue: 2916.63,
		});

		expect(data.portfolioValue).toBe(29316.69);
		const summed = portfolio.reduce((total, h) => total + h.marketValue, 0);
		expect(summed).toBeCloseTo(data.portfolioValue ?? 0, 2);
	});

	test("throws when the statement date is missing", () => {
		expect(() =>
			chocolate.extractData([makePage(["no date here"])], testUser.id),
		).toThrow("statement date");
	});

	test("throws when the transactions section is missing", () => {
		expect(() =>
			chocolate.extractData(
				[makePage(["September 2025"]), makePage(["nothing relevant"])],
				testUser.id,
			),
		).toThrow("account transactions");
	});

	test("throws when the portfolio section is incomplete", () => {
		expect(() =>
			chocolate.extractData(
				[
					makePage(["September 2025"]),
					makePage(["Your transactions", "Chocolate Managed Account"]),
				],
				testUser.id,
			),
		).toThrow("portfolio items");
	});
});
