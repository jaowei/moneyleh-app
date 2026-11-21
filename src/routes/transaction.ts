import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { db } from "../db/db.ts";
import {
	accounts,
	cards,
	securityTypeZ,
	statementOwnerships,
	statements,
	type TagSelectSchema,
	type TransactionsSelectSchema,
	type TransactionTagsInsertSchema,
	tagSelectSchemaZ,
	tags as tagsDb,
	transactionShares,
	transactionSharesInsertSchemaZ,
	type transactionSharesSelectSchema,
	transactions as transactionsDb,
	transactionsInsertSchemaZ,
	transactionsUpdateSchemaZ,
	transactionTags as transactionTagsDb,
	userAccounts,
	userCards,
} from "../db/schema.ts";
import { csvParserDirectUpload } from "../lib/csv/directUpload.ts";
import type { DocumentToAdd } from "../lib/descriptionTagger/base-classifier.ts";
import { appLogger } from "../lib/logger.ts";
import { zodValidator } from "../lib/middleware/zod-validator.ts";
import { persistHoldings } from "./holdings.utils.ts";
import { paginationZ, refineAccountOrCardId } from "./route.types.ts";
import { deleteTransactions, findUserOrThrow } from "./route.utils.ts";
import {
	assignEntityToUser,
	getSplitTransactions,
	insertStatementRow,
	insertStatementTransactions,
	type PersistTransactionsResult,
	runTrainer,
	upsertTransactionShare,
} from "./transaction.utils.ts";
import { statementInfoZ } from "./ui.ts";

const allowOnlyAccountOrCardIdErrMsg =
	"An account id or card id is required, both cannot be empty and filled in the same transaction";
const uiTagZ = tagSelectSchemaZ.partial().extend({
	id: z.number(),
	description: z.string().min(1),
});
const transactionShareZ = transactionSharesInsertSchemaZ
	.pick({ share: true, userId: true })
	.optional();
const transactionFromUIZ = transactionsInsertSchemaZ
	.extend({
		tags: z.array(uiTagZ).optional(),
		userId: z.string(),
		split: transactionShareZ,
	})
	.refine((data) => refineAccountOrCardId(data), {
		error: allowOnlyAccountOrCardIdErrMsg,
	});
export type TransactionFromUIItem = z.infer<typeof transactionFromUIZ>;
const transactionsFromUIZ = z.array(transactionFromUIZ);

const cardInfoPayloadZ = z
	.object({
		cardId: z.coerce.number(),
		cardName: z.string(),
	})
	.optional();
const accountInfoPayloadZ = z
	.object({
		accountId: z.coerce.number(),
		accountName: z.string(),
	})
	.optional();
const holdingPayloadZ = z.object({
	instrumentName: z.string().min(1),
	instrumentIsin: z.string().min(1).optional(),
	instrumentSymbol: z.string().min(1).optional(),
	securityType: securityTypeZ.optional(),
	units: z.number(),
	price: z.number(),
	marketValue: z.number(),
	currency: z.string().min(1),
	costBasis: z.number().optional(),
	unrealisedGain: z.number().optional(),
	unrealisedGainPct: z.number().optional(),
	allocationPct: z.number().optional(),
	extra: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
	/** Set when the instrument was already mapped during upload. */
	securityId: z.number().optional(),
});
const statementInfoPayloadZ = statementInfoZ
	.omit({ statementOwnerIds: true })
	.extend({ statementOwnershipId: z.number() });
type StatementInfoPayload = z.infer<typeof statementInfoPayloadZ>;
const PostTransactionPayloadZ = z
	.object({
		transactions: transactionsFromUIZ.optional(),
		/** Portfolio snapshots, only produced by broker statements. */
		holdings: z.array(holdingPayloadZ).optional(),
		statementInfo: statementInfoPayloadZ,
		cardInfo: cardInfoPayloadZ,
		accountInfo: accountInfoPayloadZ,
		companyId: z.coerce.number(),
		/**
		 * Required for holdings-only statements, which have no transaction to
		 * read the user from.
		 */
		userId: z.string().optional(),
	})
	.refine(
		(data) =>
			(data.transactions?.length ?? 0) > 0 || (data.holdings?.length ?? 0) > 0,
		{ message: "At least one transaction or holding is required" },
	);
export type PostTransactionPayload = z.infer<typeof PostTransactionPayloadZ>;

const postTransactionCsvPayloadZ = z
	.object({
		userId: z.string(),
		accountId: z.coerce.number().optional(),
		cardId: z.coerce.number().optional(),
		file: z
			.file()
			.mime(["text/csv"])
			.max(1000 * 1000), // max 1mb
	})
	.refine((data) => refineAccountOrCardId(data), {
		error: allowOnlyAccountOrCardIdErrMsg,
	});

const transactionsPatchPayloadZ = z.object({
	transactions: z
		.array(
			transactionsUpdateSchemaZ.extend({
				id: z.number(),
				tags: z.array(uiTagZ).optional(),
				split: transactionShareZ,
			}),
		)
		.min(1),
});
export type PatchTransactionPayload = z.infer<typeof transactionsPatchPayloadZ>;

const getUserTransactionsQueryZ = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("account"),
		accountId: z.coerce.number(),
		...paginationZ.shape,
	}),
	z.object({
		type: z.literal("card"),
		cardId: z.coerce.number(),
		...paginationZ.shape,
	}),
]);

const assertStatementNotDuplicate = async (
	statementInfo: StatementInfoPayload,
	userId: string,
	name?: string,
) => {
	const existing = await db
		.select()
		.from(statements)
		.leftJoin(
			statementOwnerships,
			eq(statements.statementOwnershipId, statementOwnerships.id),
		)
		.where(
			and(
				eq(statements.userId, userId),
				eq(statements.statementDate, statementInfo.statementDate),
				eq(statements.statementOwnershipId, statementInfo.statementOwnershipId),
			),
		);
	if (existing.length > 0) {
		throw new HTTPException(400, {
			message: `Statement for: ${name} | statement date: ${statementInfo.statementDate} already added`,
		});
	}
};

export const transactionRoute = new Hono()
	.post("/", zodValidator("json", PostTransactionPayloadZ), async (c) => {
		const {
			transactions,
			holdings,
			statementInfo,
			cardInfo,
			accountInfo,
			companyId,
			userId: payloadUserId,
		} = c.req.valid("json");
		const transactionsToInsert = transactions ?? [];
		const holdingsToInsert = holdings ?? [];
		const accountCardName = cardInfo?.cardName || accountInfo?.accountName;

		const userId = payloadUserId ?? transactionsToInsert[0]?.userId;
		if (!userId) {
			throw new HTTPException(400, {
				message: "User id is not provided!",
			});
		}
		if (holdingsToInsert.length && !accountInfo?.accountId) {
			throw new HTTPException(400, {
				message: "Portfolio holdings can only be saved against an account",
			});
		}

		await assertStatementNotDuplicate(statementInfo, userId, accountCardName);

		let trainingResult: PersistTransactionsResult = {
			shouldTrain: false,
			documentsToAdd: [],
			insertedTransactionIds: [],
		};
		try {
			db.transaction((tx) => {
				appLogger("Checking statement details...");
				const statement = insertStatementRow(tx, {
					statementInfo,
					userId,
					name: accountCardName,
				});

				assignEntityToUser(tx, {
					userId,
					companyId,
					accountInfo,
					cardInfo,
				});

				if (transactionsToInsert.length) {
					appLogger("Processing transactions...");
					trainingResult = insertStatementTransactions(tx, {
						transactionsToInsert,
						statementId: statement.id,
						userId,
					});
				}

				if (holdingsToInsert.length && accountInfo?.accountId) {
					appLogger(
						`Processing ${holdingsToInsert.length} portfolio holdings...`,
					);
					persistHoldings(tx, {
						userId,
						companyId,
						accountId: accountInfo.accountId,
						statementId: statement.id,
						asOfDate: statementInfo.statementDate,
						holdings: holdingsToInsert,
					});
					appLogger("Portfolio holdings persisted");
				}
			});
		} catch (e) {
			const message = e instanceof Error ? e.message : JSON.stringify(e);
			throw new HTTPException(400, {
				message,
			});
		}

		if (trainingResult.shouldTrain && trainingResult.documentsToAdd.length) {
			runTrainer(
				trainingResult.documentsToAdd,
				trainingResult.insertedTransactionIds,
				{
					userId,
					transactionsInserted: trainingResult.insertedTransactionIds.length,
				},
			);
		}

		return c.text("All inserted", 201);
	})
	.post("/csv", zodValidator("form", postTransactionCsvPayloadZ), async (c) => {
		const { userId, accountId, cardId, file } = c.req.valid("form");

		await findUserOrThrow(userId);

		const notAssignedError = new HTTPException(400, {
			message: `The card/account has not been assigned to user!`,
		});
		if (cardId) {
			const findCard = await db
				.select()
				.from(userCards)
				.where(and(eq(userCards.userId, userId), eq(userCards.cardId, cardId)));
			if (!findCard.length) {
				throw notAssignedError;
			}
		} else if (accountId) {
			const findAccount = await db
				.select()
				.from(userAccounts)
				.where(
					and(
						eq(userAccounts.userId, userId),
						eq(userAccounts.accountId, accountId),
					),
				);
			if (!findAccount.length) {
				throw notAssignedError;
			}
		}

		const parsedTransactions = await csvParserDirectUpload(file);

		const documentsToAdd: DocumentToAdd[] = [];

		const insertedTransactionIds: number[] = [];

		try {
			db.transaction((tx) => {
				const txnMap: Record<string, Set<string>> = {};
				const txnToInsert = [];
				let allTags = new Set<string>();

				for (const t of parsedTransactions) {
					const tags = new Set<string>(t.tags);

					if (t.transactiontype) {
						tags.add(t.transactiontype);
					}

					if (t.transactionmethod) {
						tags.add(t.transactionmethod);
					}
					const key = `${t.date}${t.description}${t.amount}`;
					txnToInsert.push({
						transactionDate: t.date,
						currency: t.currency,
						amount: t.amount,
						description: t.description,
						cardId,
						accountId,
						userId,
					});
					txnMap[key] = tags;
					allTags = tags.union(allTags);
				}

				const insertedT = tx
					.insert(transactionsDb)
					.values(txnToInsert)
					.returning()
					.all();
				if (!insertedT.length) {
					throw new Error("No transactions inserted");
				}

				if (insertedT.length !== txnToInsert.length) {
					appLogger(
						`Transactions inserted ${insertedT.length} out of ${txnToInsert.length}`,
					);
					throw new Error(" Not all transactions inserted");
				}
				insertedTransactionIds.push(...insertedT.map((txn) => txn.id));

				const existingTagsQuery = tx
					.select()
					.from(tagsDb)
					.where(inArray(tagsDb.description, [...allTags]))
					.all();
				const existingTagSet = new Set<string>(
					existingTagsQuery.map((existing) => existing.description),
				);
				const tagsToAddSet = allTags.difference(existingTagSet);
				const tagsToAdd = [...tagsToAddSet].map((add) => ({
					description: add,
				}));
				let insertedTags: TagSelectSchema[] = [];
				if (tagsToAdd.length) {
					insertedTags = tx.insert(tagsDb).values(tagsToAdd).returning().all();
					if (!insertedTags.length) {
						throw new Error("No tags added");
					}
					if (insertedTags.length !== tagsToAdd.length) {
						throw new Error("Not all tags inserted");
					}
				}

				const tagsFound: TransactionTagsInsertSchema[] = [];
				for (const inserted of insertedT) {
					const matcherKey = `${inserted.transactionDate}${inserted.description}${inserted.amount}`;
					if (txnMap[matcherKey]) {
						for (const tag of txnMap[matcherKey]) {
							const foundTag = existingTagsQuery
								.concat(insertedTags)
								.find((tagDb) => tagDb.description === tag);
							if (!foundTag) {
								throw new Error(`Cannot find tag ${tag} in db`);
							}
							documentsToAdd.push({
								description: inserted.description,
								tag,
								transactionId: inserted.id,
							});
							tagsFound.push({
								transactionId: inserted.id,
								tagId: foundTag.id,
							});
						}
					}
				}

				const insertRes = tx
					.insert(transactionTagsDb)
					.values(tagsFound)
					.returning()
					.all();

				if (insertRes.length !== tagsFound.length) {
					throw new Error(
						`Supposed to add ${tagsFound.length} tagged transactions, only added ${insertRes.length}`,
					);
				}
			});
		} catch (e) {
			const message = e instanceof Error ? e.message : JSON.stringify(e);
			throw new HTTPException(400, {
				message,
			});
		}

		runTrainer(documentsToAdd, insertedTransactionIds, {
			userId,
			transactionsInserted: insertedTransactionIds.length,
		});

		return c.text("All inserted", 201);
	})
	.get(
		"/:userId",
		zodValidator("query", getUserTransactionsQueryZ),
		async (c) => {
			const { userId } = c.req.param();
			const { limit, offset, ...targetId } = c.req.valid("query");

			const isAccount = targetId.type === "account";
			const usersFilter = eq(transactionsDb.userId, userId);
			const transactionFilter = isAccount
				? and(usersFilter, eq(transactionsDb.accountId, targetId.accountId))
				: and(usersFilter, eq(transactionsDb.cardId, targetId.cardId));

			await findUserOrThrow(userId);

			let displayName = "";
			if (isAccount) {
				const accountQuery = await db
					.select()
					.from(accounts)
					.where(eq(accounts.id, targetId.accountId));
				if (accountQuery[0]) {
					displayName = accountQuery[0].name;
				}
			} else {
				const cardQuery = await db
					.select()
					.from(cards)
					.where(eq(cards.id, targetId.cardId));
				if (cardQuery[0]) {
					displayName = `${cardQuery[0].name} - ${cardQuery[0].cardNetwork}`;
				}
			}

			const queryRes = await db
				.select()
				.from(transactionsDb)
				.where(transactionFilter)
				.leftJoin(
					transactionTagsDb,
					eq(transactionTagsDb.transactionId, transactionsDb.id),
				)
				.leftJoin(tagsDb, eq(transactionTagsDb.tagId, tagsDb.id))
				.leftJoin(accounts, eq(accounts.id, transactionsDb.accountId))
				.leftJoin(cards, eq(cards.id, transactionsDb.cardId))
				.leftJoin(
					transactionShares,
					eq(transactionShares.transactionId, transactionsDb.id),
				)
				.orderBy(desc(transactionsDb.transactionDate))
				.limit(limit)
				.offset(offset);

			const processedTransactions = queryRes.map((row) => {
				const txn = row.transactions;
				const tag = row.tags;
				const split = row.transaction_shares;
				return {
					...txn,
					tags: tag ? [tag] : [],
					accountName: row.accounts ? row.accounts.name : undefined,
					cardName: row.cards
						? `${row.cards.name} ${row.cards.cardNetwork}`
						: undefined,
					split: split ? split : undefined,
				};
			});

			const uniqueTransactionsMap = new Map<
				number,
				TransactionsSelectSchema & {
					tags: Pick<TagSelectSchema, "id" | "description">[];
					accountName?: string;
					cardName?: string;
					split?: Pick<transactionSharesSelectSchema, "share" | "userId">;
				}
			>();
			processedTransactions.forEach((t) => {
				const transaction = uniqueTransactionsMap.get(t.id);
				if (transaction) {
					transaction.tags.push(...t.tags);
				} else {
					uniqueTransactionsMap.set(t.id, t);
				}
			});
			const transactionsToReturn = Array.from(uniqueTransactionsMap.values());

			const totalNumTxnsQuery = await db
				.select({ value: count(transactionsDb.id) })
				.from(transactionsDb)
				.where(transactionFilter);

			let transactionCount = 0;
			if (totalNumTxnsQuery[0]) {
				transactionCount = totalNumTxnsQuery[0].value;
			}

			const sumSql = sql<number>`sum(
        ${transactionsDb.amount}
        )`;
			const totalValueQuery = await db
				.select({
					currency: transactionsDb.currency,
					sum: sumSql,
				})
				.from(transactionsDb)
				.where(transactionFilter)
				.groupBy(transactionsDb.currency);

			const valueByCurrency: Record<string, number> = {};
			for (const queryRes of totalValueQuery) {
				if (!valueByCurrency[queryRes.currency] && queryRes.sum) {
					valueByCurrency[queryRes.currency] = queryRes.sum;
				} else {
					valueByCurrency[queryRes.currency] = 0;
				}
			}

			const yearMonthSql = sql<string>`strftime
        ('%Y-%m',
        ${transactionsDb.transactionDate}
        )`;
			const movementByYearMonth = await db
				.select({
					currency: transactionsDb.currency,
					yearMonth: yearMonthSql,
					sum: sumSql,
				})
				.from(transactionsDb)
				.where(transactionFilter)
				.groupBy(yearMonthSql, transactionsDb.currency)
				.orderBy(yearMonthSql);

			type ChartValuesLabels = {
				labels: string[];
				movementValues: number[];
				balanceValues: number[];
			};
			const chartData: Record<string, ChartValuesLabels> = {};

			for (const movement of movementByYearMonth) {
				const { yearMonth, sum } = movement;
				if (!chartData[movement.currency]) {
					chartData[movement.currency] = {
						labels: [yearMonth],
						movementValues: [sum],
						balanceValues: [],
					};
				} else {
					chartData[movement.currency]?.movementValues.push(sum);
					chartData[movement.currency]?.labels.push(yearMonth);
				}
			}

			Object.entries(chartData).forEach(([currency, values]) => {
				const valueByYearMonth = values.movementValues.reduce(
					(prev, currentSum) => {
						const prevSum = prev.at(-1);
						if (prevSum === undefined) {
							prev.push(currentSum);
						} else {
							prev.push(currentSum + prevSum);
						}
						return prev;
					},
					[] as number[],
				);
				chartData[currency]?.balanceValues.push(...valueByYearMonth);
			});

			return c.json({
				displayName,
				transactions: transactionsToReturn,
				transactionCount,
				valueByCurrency,
				chartData,
			});
		},
	)
	.patch(
		"/:userId",
		zodValidator("json", transactionsPatchPayloadZ),
		async (c) => {
			const { transactions } = c.req.valid("json");
			const { userId } = c.req.param();
			db.transaction((tx) => {
				for (const t of transactions) {
					const updateRes = tx
						.update(transactionsDb)
						.set({
							...t,
							updated_at: new Date().toISOString(),
						})
						.where(eq(transactionsDb.id, t.id))
						.returning({ id: transactionsDb.id })
						.all();
					if (!updateRes.length) {
						throw new HTTPException(400, {
							message: `Could not update transaction id (${t.id})`,
						});
					}
					if (t.tags && t.tags.length > 0) {
						for (const tag of t.tags) {
							try {
								tx.insert(transactionTagsDb)
									.values({
										tagId: tag.id,
										transactionId: t.id,
									})
									.returning()
									.onConflictDoNothing()
									.all();
							} catch {
								throw new HTTPException(400, {
									message: `Could not update tag id (${tag.id})`,
								});
							}
						}
					}
					if (t.split) {
						upsertTransactionShare(
							{
								transactionId: t.id,
								...t.split,
							},
							userId,
						);
					}
				}
			});
			return c.text(`Updated ${transactions.length} transactions`);
		},
	)
	.delete("/:userId/:transactionId", async (c) => {
		const { userId, transactionId } = c.req.param();
		const txnIdInt = parseInt(transactionId, 10);
		deleteTransactions([txnIdInt], userId);
		return c.text("deleted!");
	})
	.get("/split/:userId/summary", async (c) => {
		const { userId } = c.req.param();

		const { transactionsToPay, transactionsToReceive, relatedUsers } =
			await getSplitTransactions(userId);

		const totalAmountToPay = transactionsToPay.reduce(
			(prev, curr) => prev + curr.amountOwed,
			0,
		);
		const totalAmountToReceive = transactionsToReceive.reduce(
			(prev, curr) => prev + curr.amountOwed,
			0,
		);

		return c.json({
			userDetails: relatedUsers,
			totalAmountToPay,
			totalAmountToReceive,
		});
	})
	.get(
		"/split/:userId/transactions",
		zodValidator("query", paginationZ),
		async (c) => {
			const { userId } = c.req.param();
			const { offset, limit } = c.req.valid("query");

			const {
				transactionsToPayByUser,
				transactionsToReceive,
				relatedUsers,
				totalTransactionsToPay,
				totalTransactionsToReceive,
			} = await getSplitTransactions(userId, {
				offset,
				limit,
			});

			return c.json({
				transactionsToPayByUser,
				transactionsToReceive,
				relatedUsers,
				totalTransactionsToPay,
				totalTransactionsToReceive,
			});
		},
	);
