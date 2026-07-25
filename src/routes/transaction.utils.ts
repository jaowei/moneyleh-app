import { and, eq } from "drizzle-orm";
import { docTrainerPool } from "..";
import { db } from "../db/db";
import {
	type TransactionSharesInsertSchema,
	transactionShares as transactionSharesDb,
} from "../db/schema";
import type { DocumentToAdd } from "../lib/descriptionTagger/base-classifier";
import { appLogger } from "../lib/logger";

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
