import { and, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { docTrainerPool } from "..";
import { user } from "../db/auth-schema";
import { db } from "../db/db";
import {
	statements,
	type TransactionSharesInsertSchema,
	tags as tagsDb,
	transactionShares,
	transactionShares as transactionSharesDb,
	transactionStatements,
	transactions,
	transactionTags,
	userAccounts,
	userCards,
	userCompanies,
} from "../db/schema";
import type { DocumentToAdd } from "../lib/descriptionTagger/base-classifier";
import { appLogger } from "../lib/logger";
import type { DbTransaction } from "./holdings.utils";
import { withPagination } from "./route.utils";
import type { TransactionFromUIItem } from "./transaction";

export const runTrainer = (
	documentsToAdd: DocumentToAdd[],
	transactionIds: number[],
	logInfo: {
		transactionsInserted: number;
		userId: string;
	},
) => {
	docTrainerPool.runTask({ documentsToAdd }, async (err) => {
		if (err) {
			appLogger(`Training failed for user ${logInfo.userId}, ${logInfo.transactionsInserted} transactions to be trained,
	            please look for json file in root, for transactions to train`);
			await Bun.write(
				`./${new Date().toISOString()}_${logInfo.userId}_failed_training.json`,
				JSON.stringify(transactionIds),
			);
		}
	});
};

const computeInsertingUserShare = (share: number) => {
	return 100 - share;
};

export type StatementInfoToPersist = {
	statementDate: string;
	statementOwnershipId: number;
};

/**
 * Inserts the statement row every confirmed upload hangs off. Must be called
 * first inside the transaction, since transactions and holdings both carry the
 * statement id.
 */
export const insertStatementRow = (
	tx: DbTransaction,
	{
		statementInfo,
		userId,
		name,
	}: {
		statementInfo: StatementInfoToPersist;
		userId: string;
		name?: string;
	},
) => {
	const inserted = tx
		.insert(statements)
		.values({
			statementDate: statementInfo.statementDate,
			userId,
			statementOwnershipId: statementInfo.statementOwnershipId,
		})
		.returning()
		.all()[0];
	if (!inserted) {
		throw new Error(
			`Error persisting statement for user ${userId}, ${name ?? "unknown"}`,
		);
	}
	appLogger(`Inserted statement for user ${userId}, ${name ?? "unknown"}`);
	return inserted;
};

/**
 * Assigns the account or card to the user when the upload is confirmed, and
 * records the company the user now has data for.
 */
export const assignEntityToUser = (
	tx: DbTransaction,
	{
		userId,
		companyId,
		accountInfo,
		cardInfo,
	}: {
		userId: string;
		companyId: number;
		accountInfo?: { accountId: number; accountName: string };
		cardInfo?: { cardId: number; cardName: string };
	},
) => {
	appLogger("Check assignment of card/account to user");
	const insertCompanyQuery = tx
		.insert(userCompanies)
		.values({ userId, companyId });
	if (accountInfo) {
		const insertedRes = tx
			.insert(userAccounts)
			.values({ accountId: accountInfo.accountId, userId })
			.returning()
			.onConflictDoNothing()
			.all();
		if (insertedRes[0]) {
			appLogger(`Inserted account ${insertedRes[0].accountId}`);
			insertCompanyQuery.returning().onConflictDoNothing().all();
		}
	} else if (cardInfo) {
		const insertedRes = tx
			.insert(userCards)
			.values({ cardId: cardInfo.cardId, userId })
			.returning()
			.onConflictDoNothing()
			.all();
		if (insertedRes[0]) {
			appLogger(`Inserted card ${insertedRes[0].cardId}`);
			insertCompanyQuery.returning().onConflictDoNothing().all();
		}
	}
	appLogger("Assignment done");
};

export type PersistTransactionsResult = {
	shouldTrain: boolean;
	documentsToAdd: DocumentToAdd[];
	insertedTransactionIds: number[];
};

export const insertStatementTransactions = (
	tx: DbTransaction,
	{
		transactionsToInsert,
		statementId,
		userId,
	}: {
		transactionsToInsert: TransactionFromUIItem[];
		statementId: number;
		userId: string;
	},
): PersistTransactionsResult => {
	const result: PersistTransactionsResult = {
		shouldTrain: false,
		documentsToAdd: [],
		insertedTransactionIds: [],
	};
	for (const t of transactionsToInsert) {
		const { tags, split, ...rest } = t;

		const findRes = tx
			.select()
			.from(transactions)
			.leftJoin(
				transactionStatements,
				eq(transactionStatements.transactionId, transactions.id),
			)
			.where(
				and(
					eq(transactions.description, t.description),
					eq(transactions.amount, t.amount),
					eq(transactions.transactionDate, t.transactionDate),
					eq(transactions.userId, t.userId),
					ne(transactionStatements.statementId, statementId),
				),
			)
			.all();

		if (findRes.length) {
			appLogger(
				`Found ${findRes.length} similar transaction/s, skipping insert`,
			);
			appLogger(`Similar transaction ids: ${JSON.stringify(findRes)}`);
			throw new Error(`Found ${findRes.length} similar transaction`);
		}

		const txnId = tx
			.insert(transactions)
			.values(rest)
			.returning({ id: transactions.id })
			.all();
		const insertedTxn = txnId[0];
		if (!insertedTxn) {
			appLogger(`WARN: Could not add transaction ${t.description}`);
			throw new Error(`Could not add transaction ${t.description}`);
		}

		const insertedTxnStm = tx
			.insert(transactionStatements)
			.values({
				transactionId: insertedTxn.id,
				statementId,
			})
			.returning()
			.all();

		if (!insertedTxnStm[0]) {
			throw new Error(
				`Could not add statement to transaction ${t.description}`,
			);
		}

		result.insertedTransactionIds.push(...txnId.map((txn) => txn.id));
		if (tags?.length) {
			const tagIds = tags.map((tag) => tag.id);
			const queryRes = tx
				.select({
					id: tagsDb.id,
					description: tagsDb.description,
				})
				.from(tagsDb)
				.where(inArray(tagsDb.id, tagIds))
				.all();

			if (queryRes.length !== tagIds.length) {
				appLogger(
					`WARN: Some tags do not exist! Inserted ${queryRes.length} out of ${tagIds.length} tags`,
				);
				appLogger(`  tagIds inserted: ${JSON.stringify(queryRes)}`);
				appLogger(`  tagIds given: ${JSON.stringify(tagIds)}`);
				throw new Error("Tag does not exist!");
			}

			const transactionTagsToInsert = queryRes.map((foundTag) => {
				result.documentsToAdd.push({
					description: t.description,
					tag: foundTag.description,
					transactionId: insertedTxn.id,
				});
				return {
					transactionId: insertedTxn.id,
					tagId: foundTag.id,
				};
			});
			const ids = tx
				.insert(transactionTags)
				.values(transactionTagsToInsert)
				.returning({ id: transactionTags.tagId })
				.all();
			if (ids.length !== queryRes.length) {
				appLogger(`WARN: Not all tags inserted`);
				throw new Error(
					`Could not insert all tags for transaction ${t.description}`,
				);
			}
			appLogger(`Inserted ${ids.length} tags`);
			result.shouldTrain = true;
		}

		if (split) {
			insertTransactionShares(
				[
					{
						transactionId: insertedTxn.id,
						...split,
					},
				],
				userId,
			);
		}
	}
	return result;
};

export const insertTransactionShares = (
	transactionShares: TransactionSharesInsertSchema[],
	insertingUserId: string,
) => {
	if (transactionShares.length) {
		try {
			appLogger(
				`${transactionShares.length} transaction/s to split for user ${insertingUserId}`,
			);
			db.transaction((tx) => {
				const inserted = tx
					.insert(transactionSharesDb)
					.values(transactionShares)
					.returning()
					.all();
				if (inserted.length !== transactionShares.length) {
					appLogger(
						`${inserted.length} transaction/s inserted, rolling back...`,
					);
					tx.rollback();
				}
				const insertingUserShares = transactionShares.map((txnShare) => ({
					...txnShare,
					userId: insertingUserId,
					share: computeInsertingUserShare(txnShare.share),
				}));
				const insertingUserInserted = tx
					.insert(transactionSharesDb)
					.values(insertingUserShares)
					.returning()
					.all();
				if (transactionShares.length !== insertingUserInserted.length) {
					appLogger(
						`${insertingUserInserted.length} transaction/s inserted, rolling back...`,
					);
					tx.rollback();
				}
			});
			appLogger(`Transactions split for user ${insertingUserId}`);
			return {
				success: true,
				data: {
					numInserted: transactionShares.length,
				},
			};
		} catch {
			appLogger(`Transactions not split for user ${insertingUserId}`);
			return {
				succcess: false,
				error: "Could not insert transaction shares",
			};
		}
	} else {
		appLogger("No transactions to split");
		return {
			success: true,
			data: {
				numInserted: transactionShares.length,
			},
		};
	}
};

export const upsertTransactionShare = (
	share: TransactionSharesInsertSchema,
	insertingUserId: string,
) => {
	try {
		db.transaction((tx) => {
			const queryRes = tx
				.select()
				.from(transactionSharesDb)
				.where(eq(transactionSharesDb.transactionId, share.transactionId))
				.all();
			if (queryRes.length === 1) {
				appLogger(
					`Could not get appropriate transaction shares, got: ${queryRes.length}`,
				);
				tx.rollback();
			} else if (queryRes.length === 0) {
				insertTransactionShares([share], insertingUserId);
			} else {
				const isSame = queryRes.find(
					(existing) =>
						existing.share === share.share && existing.userId === share.userId,
				);
				if (!isSame) {
					tx.update(transactionSharesDb)
						.set({ share: computeInsertingUserShare(share.share) })
						.where(
							and(
								eq(transactionSharesDb.userId, insertingUserId),
								eq(transactionSharesDb.transactionId, share.transactionId),
							),
						)
						.returning()
						.all();
					tx.update(transactionSharesDb)
						.set({ share: share.share, userId: share.userId })
						.where(
							and(
								eq(transactionSharesDb.userId, share.userId),
								eq(transactionSharesDb.transactionId, share.transactionId),
							),
						)
						.returning()
						.all();
				} else {
					appLogger(
						`Nothing to update share is the same for user: ${insertingUserId}, txn: ${share.transactionId}`,
					);
				}
			}
		});
	} catch (error) {
		appLogger(`Could not insert transaction shares: ${error}`);
	}
};

export const getSplitTransactions = async (
	userId: string,
	pagination?: { offset: number; limit: number },
) => {
	appLogger(`Getting transaction splits for user ${userId}`);
	const sharedTxnIdsQuery = await db
		.select({ transactionId: transactionShares.transactionId })
		.from(transactionShares)
		.where(eq(transactionShares.userId, userId));
	const sharedTxnIds = sharedTxnIdsQuery.map((q) => q.transactionId);
	appLogger(
		`Found ${sharedTxnIds.length} transactions related to user ${userId}`,
	);

	const relatedUsers = await db
		.selectDistinct({ id: user.id, name: user.name, email: user.email })
		.from(user)
		.innerJoin(transactionShares, eq(transactionShares.userId, user.id))
		.where(
			and(
				inArray(transactionShares.transactionId, sharedTxnIds),
				ne(transactionShares.userId, userId),
			),
		)
		.groupBy(user.id);
	const relatedUserIds = relatedUsers.map((q) => q.id);
	appLogger(`${relatedUsers.length} other related users found`);

	const splitTxnColumns = {
		id: transactions.id,
		user: transactions.userId,
		transactionDate: transactions.transactionDate,
		description: transactions.description,
		transactionAmount: transactions.amount,
		share: transactionShares.share,
		// credit card transactions are credits i.e. negative
		amountOwed: sql<number>`(100 - ${transactionShares.share})/100 * abs(${transactions.amount})`,
	};

	const toPayFilter = and(
		inArray(transactionShares.transactionId, sharedTxnIds),
		inArray(transactionShares.userId, relatedUserIds),
		ne(transactions.userId, userId),
	);
	const toReceiveFilter = and(
		eq(transactions.userId, userId),
		eq(transactionShares.userId, userId),
	);

	appLogger(`Getting transactions to pay`);
	const txnToPayQuery = db
		.select(splitTxnColumns)
		.from(transactionShares)
		.innerJoin(
			transactions,
			eq(transactionShares.transactionId, transactions.id),
		)
		.where(toPayFilter);

	const countToPay = () =>
		db
			.select({ value: count() })
			.from(transactionShares)
			.innerJoin(
				transactions,
				eq(transactionShares.transactionId, transactions.id),
			)
			.where(toPayFilter);

	appLogger(`Getting transactions to receive`);
	const txnToReceiveQuery = db
		.select(splitTxnColumns)
		.from(transactions)
		.leftJoin(
			transactionShares,
			eq(transactionShares.transactionId, transactions.id),
		)
		.where(toReceiveFilter)
		.orderBy();

	const countToReceive = () =>
		db
			.select({ value: count() })
			.from(transactions)
			.leftJoin(
				transactionShares,
				eq(transactionShares.transactionId, transactions.id),
			)
			.where(toReceiveFilter);

	let txnsToPay = [];
	let txnsToReceive = [];
	let totalTransactionsToPay = 0;
	let totalTransactionsToReceive = 0;

	if (pagination) {
		const [toPayPage, toReceivePage, toPayCount, toReceiveCount] =
			await Promise.all([
				withPagination(
					txnToPayQuery.$dynamic(),
					desc(transactions.transactionDate),
					pagination.offset + 1,
					pagination.limit,
				),
				withPagination(
					txnToReceiveQuery.$dynamic(),
					desc(transactions.transactionDate),
					pagination.offset + 1,
					pagination.limit,
				),
				countToPay(),
				countToReceive(),
			]);
		txnsToPay = toPayPage;
		txnsToReceive = toReceivePage;
		totalTransactionsToPay = toPayCount[0]?.value ?? 0;
		totalTransactionsToReceive = toReceiveCount[0]?.value ?? 0;
	} else {
		txnsToPay = await txnToPayQuery;
		txnsToReceive = await txnToReceiveQuery;
		totalTransactionsToPay = txnsToPay.length;
		totalTransactionsToReceive = txnsToReceive.length;
	}

	const txnToPayByUser = relatedUserIds.map((userId) => {
		return txnsToPay.filter((txn) => txn.user === userId);
	});

	return {
		transactionsToPayByUser: txnToPayByUser,
		transactionsToReceive: txnsToReceive,
		relatedUsers,
		transactionsToPay: txnsToPay,
		totalTransactionsToPay,
		totalTransactionsToReceive,
	};
};
