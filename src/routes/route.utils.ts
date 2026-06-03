import { and, eq, inArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { user } from "../db/auth-schema.ts";
import { db } from "../db/db.ts";
import {
	statementOwnerships,
	statements,
	transactionStatements,
	transactions,
	transactionTags,
	userAccounts,
	userCards,
} from "../db/schema.ts";

export const findUserOrThrow = async (userId: string) => {
	const targetUser = await db.select().from(user).where(eq(user.id, userId));

	if (!targetUser.length) {
		throw new HTTPException(404, {
			message: `user id: ${userId} was not found!`,
		});
	}

	return targetUser;
};

export const getStatementOwnerByIdentifier = async (target: string) => {
	return await db
		.select()
		.from(statementOwnerships)
		.where(
			sql`lower(${statementOwnerships.identifier}) = ${target.toLowerCase()}`,
		);
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

		tx.delete(transactionTags)
			.where(inArray(transactionTags.transactionId, transactionIds))
			.all();

		const statementRes = tx
			.delete(transactionStatements)
			.where(inArray(transactionStatements.transactionId, transactionIds))
			.returning()
			.all();

		const statementIds = statementRes.map((s) => s.statementId);

		tx.delete(statements).where(inArray(statements.id, statementIds)).all();

		tx.delete(transactions)
			.where(inArray(transactions.id, transactionIds))
			.all();
	});
};
