import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db/db";
import {
	accounts,
	cards,
	companies,
	securityToStatementMappers,
	statementOwnerships,
} from "../db/schema";
import type { BrokerHolding } from "../lib/pdf/pdf.type";
import { getHoldingIdentifier, type HoldingToPersist } from "./holdings.utils";

export const getStatementOwnerByIdentifier = async (target: string) => {
	return await db
		.select()
		.from(statementOwnerships)
		.where(
			sql`lower(${statementOwnerships.identifier}) = ${target.toLowerCase()}`,
		);
};

export type AvailableEntity = { id: number; name: string; companyName: string };

// "broker" statements are persisted against an account, so they share the
// account resolution path.
export type StatementEntityType = "card" | "account";

export type EntityResult =
	| {
			found: true;
			entityId: number;
			name: string;
			linkId: number;
	  }
	| {
			found: false;
			availableEntities: AvailableEntity[];
	  };

const getAvailableEntities = async (
	entityType: StatementEntityType,
	companyName: string,
): Promise<AvailableEntity[]> => {
	if (entityType === "card") {
		return await db
			.select({
				id: cards.id,
				name: cards.name,
				companyName: companies.name,
			})
			.from(cards)
			.innerJoin(companies, eq(companies.id, cards.companyId))
			.where(eq(companies.name, companyName));
	}
	return await db
		.select({
			id: accounts.id,
			name: accounts.name,
			companyName: companies.name,
		})
		.from(accounts)
		.innerJoin(companies, eq(companies.id, accounts.companyId))
		.where(eq(companies.name, companyName));
};

const getLinkedEntity = async (
	entityType: StatementEntityType,
	entityId: number,
) => {
	if (entityType === "card") {
		const [card] = await db.select().from(cards).where(eq(cards.id, entityId));
		return card;
	}
	const [account] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, entityId));
	return account;
};

export const getEntityFromParsedNames = async (
	parsedName: string,
	parsedCompanyName: string,
	entityType: StatementEntityType,
): Promise<EntityResult> => {
	const [statementOwner] = await getStatementOwnerByIdentifier(parsedName);

	if (statementOwner) {
		const linkedId =
			entityType === "card" ? statementOwner.cardId : statementOwner.accountId;
		if (!linkedId) {
			throw new HTTPException(500, {
				message: `Statement identifier "${parsedName}" is not linked to a ${entityType}`,
			});
		}
		const entity = await getLinkedEntity(entityType, linkedId);
		if (!entity) {
			throw new HTTPException(500, {
				message: `Could not find the ${entityType} linked to statement identifier "${parsedName}"`,
			});
		}
		return {
			found: true,
			entityId: entity.id,
			name: entity.name,
			linkId: statementOwner.id,
		};
	}

	return {
		found: false,
		availableEntities: await getAvailableEntities(
			entityType,
			parsedCompanyName,
		),
	};
};

export type PortfolioHolding = HoldingToPersist;

/**
 * Attaches already known securities to parsed holdings. Nothing is created
 * here: the user confirms the statement first, and securities are created on
 * save for any holding that is still unmapped.
 */
export const attachKnownSecurities = async (
	companyId: number,
	holdings: BrokerHolding[],
): Promise<PortfolioHolding[]> => {
	if (!holdings.length) {
		return [];
	}
	const mappers = await db
		.select()
		.from(securityToStatementMappers)
		.where(eq(securityToStatementMappers.companyId, companyId));
	const securityIdByIdentifier = new Map(
		mappers.map((mapper) => [
			mapper.identifier.toLowerCase(),
			mapper.securityId,
		]),
	);
	return holdings.map((holding) => ({
		...holding,
		securityId: securityIdByIdentifier.get(
			getHoldingIdentifier(holding).toLowerCase(),
		),
	}));
};
