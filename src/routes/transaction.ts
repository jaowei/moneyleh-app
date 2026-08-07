import { and, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { db } from "../db/db.ts";
import {
	accounts,
	cards,
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
	transactionStatements,
	transactions as transactionsDb,
	transactionsInsertSchemaZ,
	transactionsUpdateSchemaZ,
	transactionTags as transactionTagsDb,
	userAccounts,
	userCards,
	userCompanies,
} from "../db/schema.ts";
import { csvParserDirectUpload } from "../lib/csv/directUpload.ts";
import type { DocumentToAdd } from "../lib/descriptionTagger/base-classifier.ts";
import { appLogger } from "../lib/logger.ts";
import { zodValidator } from "../lib/middleware/zod-validator.ts";
import { paginationZ, refineAccountOrCardId } from "./route.types.ts";
import { deleteTransactions, findUserOrThrow } from "./route.utils.ts";
import {
	getSplitTransactions,
	insertTransactionShares,
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
const transactionsFromUIZ = z.array(transactionFromUIZ).min(1);
export type TransactionFromUI = z.infer<typeof transactionsFromUIZ>;

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
const statementInfoPayloadZ = statementInfoZ
	.omit({ statementOwnerIds: true })
	.extend({ statementOwnershipId: z.number() });
type StatementInfoPayload = z.infer<typeof statementInfoPayloadZ>;
const PostTransactionPayloadZ = z.object({
	transactions: transactionsFromUIZ,
	statementInfo: statementInfoPayloadZ,
	cardInfo: cardInfoPayloadZ,
	accountInfo: accountInfoPayloadZ,
	companyId: z.coerce.number(),
});
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

export const transactionRoute = new Hono()
	.post("/", zodValidator("json", PostTransactionPayloadZ), async (c) => {
		const { transactions, statementInfo, cardInfo, accountInfo, companyId } =
			c.req.valid("json");

		const accountCardName = cardInfo?.cardName || accountInfo?.accountName;

		const addStatementOrThrow = async (
			statementInfo: StatementInfoPayload,
			userId: string,
			name?: string,
		) => {
			const existingStatementQuery = await db
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
						eq(
							statements.statementOwnershipId,
							statementInfo.statementOwnershipId,
						),
					),
				);

			if (existingStatementQuery.length > 0) {
				throw new HTTPException(400, {
					message: `Statement for: ${name} | statement date: ${statementInfo.statementDate} already added`,
				});
			}
		};

		let shouldTrain = false;
		const documentsToAdd: DocumentToAdd[] = [];
		const insertedTransactionIds: number[] = [];
		const userId = transactions[0]?.userId;
		if (!userId) {
			throw new HTTPException(400, {
				message: "User id is not provided!",
			});
		}
		await addStatementOrThrow(statementInfo, userId, accountCardName);
		try {
			db.transaction((tx) => {
				appLogger("Checking statement details...");
				const insertedStatement = tx
					.insert(statements)
					.values({
						statementDate: statementInfo.statementDate,
						userId,
						statementOwnershipId: statementInfo.statementOwnershipId,
					})
					.returning()
					.all();
				if (!insertedStatement[0]) {
					tx.rollback();
					throw new Error(
						`Error persisting statement for user ${userId}, ${accountCardName}`,
					);
				}
				appLogger(`Inserted statement for user ${userId}, ${accountCardName}`);

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

				appLogger("Processing transactions...");
				for (const t of transactions) {
					const { tags, split, ...rest } = t;

					const findRes = tx
						.select()
						.from(transactionsDb)
						.leftJoin(
							transactionStatements,
							eq(transactionStatements.transactionId, transactionsDb.id),
						)
						.where(
							and(
								eq(transactionsDb.description, t.description),
								eq(transactionsDb.amount, t.amount),
								eq(transactionsDb.transactionDate, t.transactionDate),
								eq(transactionsDb.userId, t.userId),
								ne(transactionStatements.statementId, insertedStatement[0].id),
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
						.insert(transactionsDb)
						.values(rest)
						.returning({ id: transactionsDb.id })
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
							statementId: insertedStatement[0].id,
						})
						.returning()
						.all();

					if (!insertedTxnStm[0]) {
						throw new Error(
							`Could not add statement to transaction ${t.description}`,
						);
					}

					insertedTransactionIds.push(...txnId.map((txn) => txn.id));
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
						} else {
							const transactionTagsToInsert = queryRes.map((foundTag) => {
								documentsToAdd.push({
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
								.insert(transactionTagsDb)
								.values(transactionTagsToInsert)
								.returning({ id: transactionTagsDb.tagId })
								.all();
							if (ids.length !== queryRes.length) {
								appLogger(`WARN: Not all tags inserted`);
								tx.rollback();
							} else {
								appLogger(`Inserted ${ids.length} tags`);
								shouldTrain = true;
							}
						}
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
			});
		} catch (e) {
			const message = e instanceof Error ? e.message : JSON.stringify(e);
			throw new HTTPException(400, {
				message,
			});
		}

		if (shouldTrain && documentsToAdd.length) {
			runTrainer(documentsToAdd, insertedTransactionIds, {
				userId,
				transactionsInserted: insertedTransactionIds.length,
			});
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
