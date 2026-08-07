import { and, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { docTrainerPool } from "..";
import { user } from "../db/auth-schema";
import { db } from "../db/db";
import {
	type TransactionSharesInsertSchema,
	transactionShares,
	transactionShares as transactionSharesDb,
	transactions,
} from "../db/schema";
import type { DocumentToAdd } from "../lib/descriptionTagger/base-classifier";
import { appLogger } from "../lib/logger";
import { withPagination } from "./route.utils";

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
