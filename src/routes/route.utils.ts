import { and, eq, inArray, type SQL } from "drizzle-orm";
import type { SQLiteColumn, SQLiteSelect } from "drizzle-orm/sqlite-core";
import { HTTPException } from "hono/http-exception";
import { user } from "../db/auth-schema.ts";
import { db } from "../db/db.ts";
import {
	holdings,
	statements,
	transactionStatements,
	transactions,
	transactionTags,
	userAccounts,
	userCards,
} from "../db/schema.ts";
import { auth } from "../lib/auth.ts";

export const findUserOrThrow = async (userId: string) => {
	const targetUser = await db.select().from(user).where(eq(user.id, userId));

	if (!targetUser.length) {
		throw new HTTPException(404, {
			message: `user id: ${userId} was not found!`,
		});
	}

	return targetUser;
};

/**
 * Requires an authenticated session whose user matches the requested user.
 * New endpoints should use this so one household member cannot read another
 * member's data by changing the id in the URL.
 */
export const assertSelfAccess = async (headers: Headers, userId: string) => {
	const session = await auth.api.getSession({ headers });
	if (!session?.user) {
		throw new HTTPException(401, {
			message: "You must be signed in to access this resource",
		});
	}
	if (session.user.id !== userId) {
		throw new HTTPException(403, {
			message: "You can only access your own data",
		});
	}
	return session.user;
};

export const removeUserAssignments = ({
	type,
	id,
	userId,
}: {
	type: "card" | "account";
	id: number;
	userId: string;
}) => {
	db.transaction((tx) => {
		const assignmentDelFilter =
			type === "card"
				? and(eq(userCards.userId, userId), eq(userCards.cardId, id))
				: and(eq(userAccounts.userId, userId), eq(userAccounts.accountId, id));
		const transactionDelFilter =
			type === "card"
				? eq(transactions.cardId, id)
				: eq(transactions.accountId, id);
		const delRes = tx
			.delete(type === "card" ? userCards : userAccounts)
			.where(assignmentDelFilter)
			.returning()
			.all();

		if (!delRes[0]) {
			throw new HTTPException(500, {
				message: `Error deleting ${type} from user`,
			});
		}

		const existingTransactionsRes = tx
			.select()
			.from(transactions)
			.where(and(eq(transactions.userId, userId), transactionDelFilter))
			.all();

		const transactionIds = existingTransactionsRes.map((t) => t.id);

		if (type === "account") {
			// Holdings are account scoped, so removing the account assignment
			// removes the portfolio snapshots recorded for this user too.
			tx.delete(holdings)
				.where(and(eq(holdings.userId, userId), eq(holdings.accountId, id)))
				.all();
		}

		deleteTransactions(transactionIds, userId);
	});
};

export const deleteTransactions = (
	transactionIds: number[],
	userId: string,
) => {
	db.transaction((tx) => {
		tx.delete(transactionTags)
			.where(inArray(transactionTags.transactionId, transactionIds))
			.all();
		const associatedStatementQuery = tx
			.select()
			.from(transactionStatements)
			.innerJoin(
				statements,
				eq(statements.id, transactionStatements.statementId),
			)
			.where(
				and(
					inArray(transactionStatements.transactionId, transactionIds),
					eq(statements.userId, userId),
				),
			)
			.all();
		if (associatedStatementQuery.length) {
			tx.delete(transactionStatements)
				.where(
					inArray(
						transactionStatements.statementId,
						associatedStatementQuery.map((res) => res.statements.id),
					),
				)
				.all();
		}
		tx.delete(transactions)
			.where(
				and(
					eq(transactions.userId, userId),
					inArray(transactions.id, transactionIds),
				),
			)
			.all();
	});
};

export function withPagination<T extends SQLiteSelect>(
	qb: T,
	orderByColumn: SQLiteColumn | SQL,
	page = 1,
	pageSize = 3,
) {
	return qb
		.orderBy(orderByColumn)
		.limit(pageSize)
		.offset((page - 1) * pageSize);
}
