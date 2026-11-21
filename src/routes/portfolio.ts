import { and, eq, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/db.ts";
import { accounts, companies, holdings, securities } from "../db/schema.ts";
import { assertSelfAccess, findUserOrThrow } from "./route.utils.ts";

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const parseExtra = (raw: string | null): Record<string, unknown> | null => {
	if (!raw) {
		return null;
	}
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" ? parsed : null;
	} catch {
		return null;
	}
};

export const portfolioRoute = new Hono().get("/:userId", async (c) => {
	const { userId } = c.req.param();
	await assertSelfAccess(c.req.raw.headers, userId);
	await findUserOrThrow(userId);

	// The latest snapshot date per account. Statements are uploaded at
	// different times per account, so each account reports its own "as of"
	// rather than a single global date.
	const latestPerAccount = await db
		.select({
			accountId: holdings.accountId,
			asOfDate: sql<string>`max(${holdings.asOfDate})`,
		})
		.from(holdings)
		.where(eq(holdings.userId, userId))
		.groupBy(holdings.accountId);

	const latestFilter = or(
		...latestPerAccount.map((latest) =>
			and(
				eq(holdings.accountId, latest.accountId),
				eq(holdings.asOfDate, latest.asOfDate),
			),
		),
	);

	const rows = latestPerAccount.length
		? await db
				.select({
					id: holdings.id,
					asOfDate: holdings.asOfDate,
					accountId: holdings.accountId,
					accountName: accounts.name,
					companyId: companies.id,
					companyName: companies.name,
					securityId: securities.id,
					securityName: securities.name,
					isin: securities.isin,
					symbol: securities.symbol,
					securityType: securities.securityType,
					units: holdings.units,
					price: holdings.price,
					marketValue: holdings.marketValue,
					currency: holdings.currency,
					costBasis: holdings.costBasis,
					unrealisedGain: holdings.unrealisedGain,
					extra: holdings.extra,
				})
				.from(holdings)
				.innerJoin(securities, eq(securities.id, holdings.securityId))
				.innerJoin(accounts, eq(accounts.id, holdings.accountId))
				.leftJoin(companies, eq(companies.id, accounts.companyId))
				.where(and(eq(holdings.userId, userId), latestFilter))
				.orderBy(companies.name, accounts.name, securities.name)
		: [];

	const totalValueByCurrency: Record<string, number> = {};
	const byTypeTotals = new Map<
		string,
		{
			securityType: string;
			currency: string;
			marketValue: number;
		}
	>();
	const byAccountTotals = new Map<
		string,
		{
			accountId: number;
			accountName: string;
			companyName: string | null;
			currency: string;
			marketValue: number;
			asOfDate: string;
		}
	>();

	for (const row of rows) {
		totalValueByCurrency[row.currency] =
			(totalValueByCurrency[row.currency] ?? 0) + row.marketValue;

		const typeKey = `${row.securityType}:${row.currency}`;
		const typeTotal = byTypeTotals.get(typeKey);
		if (typeTotal) {
			typeTotal.marketValue += row.marketValue;
		} else {
			byTypeTotals.set(typeKey, {
				securityType: row.securityType,
				currency: row.currency,
				marketValue: row.marketValue,
			});
		}

		const accountKey = `${row.accountId}:${row.currency}`;
		const accountTotal = byAccountTotals.get(accountKey);
		if (accountTotal) {
			accountTotal.marketValue += row.marketValue;
		} else {
			byAccountTotals.set(accountKey, {
				accountId: row.accountId,
				accountName: row.accountName,
				companyName: row.companyName,
				currency: row.currency,
				marketValue: row.marketValue,
				asOfDate: row.asOfDate,
			});
		}
	}

	const latestDate = rows.reduce(
		(latest, row) => (row.asOfDate > latest ? row.asOfDate : latest),
		"",
	);

	return c.json({
		asOfDate: latestDate || null,
		totalValueByCurrency: Object.fromEntries(
			Object.entries(totalValueByCurrency).map(([currency, value]) => [
				currency,
				roundMoney(value),
			]),
		),
		holdings: rows.map((row) => ({
			...row,
			extra: parseExtra(row.extra),
		})),
		byType: Array.from(byTypeTotals.values()).map((entry) => ({
			...entry,
			marketValue: roundMoney(entry.marketValue),
		})),
		byAccount: Array.from(byAccountTotals.values()).map((entry) => ({
			...entry,
			marketValue: roundMoney(entry.marketValue),
		})),
	});
});
