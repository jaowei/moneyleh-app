import { and, eq, sql } from "drizzle-orm";
import type { db } from "../db/db";
import {
	holdings as holdingsDb,
	securities,
	securityToStatementMappers,
} from "../db/schema";
import { appLogger } from "../lib/logger";
import type { BrokerHolding } from "../lib/pdf/pdf.type";

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type HoldingToPersist = BrokerHolding & {
	/** Set when the instrument was already mapped during upload. */
	securityId?: number;
};

/**
 * The identifier that links a holding to a security. ISINs are stable across
 * brokers, so they win over the printed name. Creation and lookup must use the
 * same key, otherwise the same instrument is created twice.
 */
export const getHoldingIdentifier = (holding: BrokerHolding) =>
	(holding.instrumentIsin ?? holding.instrumentName).trim();

/**
 * Inserts one snapshot per instrument per statement date. The security and its
 * statement mapping are created on first sight, so the user confirming the
 * statement is what materialises securities. A second snapshot for the same
 * account, instrument and date is rejected rather than overwritten, so
 * historical values are never silently replaced.
 */
export const persistHoldings = (
	tx: DbTransaction,
	{
		userId,
		companyId,
		accountId,
		statementId,
		asOfDate,
		holdings,
	}: {
		userId: string;
		companyId: number;
		accountId: number;
		statementId: number;
		asOfDate: string;
		holdings: HoldingToPersist[];
	},
) => {
	for (const holding of holdings) {
		const identifier = getHoldingIdentifier(holding);
		const mapped = tx
			.select()
			.from(securityToStatementMappers)
			.where(
				and(
					eq(securityToStatementMappers.companyId, companyId),
					sql`lower(${securityToStatementMappers.identifier}) = ${identifier.toLowerCase()}`,
				),
			)
			.all()[0];

		let securityId = mapped?.securityId ?? holding.securityId;
		if (securityId && !mapped) {
			const knownSecurity = tx
				.select({ id: securities.id })
				.from(securities)
				.where(eq(securities.id, securityId))
				.all()[0];
			if (!knownSecurity) {
				throw new Error(
					`Security ${securityId} for "${holding.instrumentName}" does not exist`,
				);
			}
		}

		if (!securityId && holding.instrumentIsin) {
			// The same instrument may already exist from another broker.
			securityId = tx
				.select({ id: securities.id })
				.from(securities)
				.where(eq(securities.isin, holding.instrumentIsin))
				.all()[0]?.id;
		}

		if (!securityId) {
			const created = tx
				.insert(securities)
				.values({
					name: holding.instrumentName,
					isin: holding.instrumentIsin ?? null,
					symbol: holding.instrumentSymbol ?? null,
					securityType: holding.securityType ?? "managedFund",
					currency: holding.currency,
				})
				.returning()
				.all()[0];
			if (!created) {
				throw new Error(
					`Could not create security for "${holding.instrumentName}"`,
				);
			}
			securityId = created.id;
			appLogger(
				`Created security ${securityId} (${holding.instrumentName}) for company ${companyId}`,
			);
		}

		if (!mapped) {
			// Keep the mapping even when the security was found by ISIN, so this
			// broker's identifier resolves on the next upload.
			tx.insert(securityToStatementMappers)
				.values({ companyId, identifier, securityId })
				.returning()
				.all();
		}

		const extra: Record<string, string | number> = {
			...(holding.extra ?? {}),
		};
		if (holding.unrealisedGainPct !== undefined) {
			extra.unrealisedGainPct = holding.unrealisedGainPct;
		}
		if (holding.allocationPct !== undefined) {
			extra.allocationPct = holding.allocationPct;
		}
		const extraJson =
			Object.keys(extra).length > 0 ? JSON.stringify(extra) : null;

		const snapshot = {
			userId,
			accountId,
			securityId,
			statementId,
			asOfDate,
			units: holding.units,
			price: holding.price,
			marketValue: holding.marketValue,
			currency: holding.currency,
			costBasis: holding.costBasis ?? null,
			unrealisedGain: holding.unrealisedGain ?? null,
			extra: extraJson,
		};
		const inserted = tx
			.insert(holdingsDb)
			.values(snapshot)
			.onConflictDoNothing()
			.returning()
			.all();
		if (!inserted[0]) {
			// A silent overwrite would destroy the historical snapshot, so a
			// second statement for the same instrument and date is rejected.
			throw new Error(
				`A holding for "${holding.instrumentName}" already exists for account ${accountId} on ${asOfDate}. Delete the existing statement before uploading this one.`,
			);
		}
	}
};
