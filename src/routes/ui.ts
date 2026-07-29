import { and, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { db } from "../db/db.ts";
import {
	accounts,
	cards,
	companies,
	type StatementOwnershipsSelectSchema,
	statementOwnerships,
	transactions,
	userAccountInsertSchemaZ,
	userAccounts,
	userCardInsertSchemaZ,
	userCards,
	userCompanies,
} from "../db/schema.ts";
import {
	type TaggedTransaction,
	tagTransactions,
} from "../lib/descriptionTagger/descriptionTagger.ts";
import { appLogger } from "../lib/logger.ts";
import { zodValidator } from "../lib/middleware/zod-validator.ts";
import { pdfParser } from "../lib/pdf/pdf.ts";
import type { PdfParser } from "../lib/pdf/pdf.type.ts";
import {
	findUserOrThrow,
	getStatementOwnerByIdentifier,
} from "./route.utils.ts";

const userAssignmentsZ = z.object({
	accountData: z
		.array(
			userAccountInsertSchemaZ.extend({
				accountId: z.number(),
			}),
		)
		.optional(),
	cardData: z
		.array(
			userCardInsertSchemaZ.extend({
				cardId: z.number(),
			}),
		)
		.optional(),
});

const fileUploadPayloadZ = z.object({
	userId: z.string(),
	file: z
		.file()
		.mime(["application/pdf"])
		.min(1 * 1000) //1kb
		.max(600 * 1000),
});

const LinkStatementPayloadZ = z.object({
	identifier: z.string().min(1),
	accountId: z.number().optional(),
	cardId: z.number().optional(),
});

export const statementInfoZ = z.object({
	statementDate: z.iso.datetime(),
	statementOwnerIds: z.array(z.number().or(z.undefined())),
});
export type StatementInfo = z.infer<typeof statementInfoZ>;

export const uiRoute = new Hono()
	.post(
		"/assignTo/:userId",
		zodValidator("json", userAssignmentsZ),
		async (c) => {
			const userId = c.req.param("userId");
			const { accountData, cardData } = c.req.valid("json");
			if (!accountData?.length && !cardData?.length) {
				c.status(400);
				return c.text("No ids to assign!");
			}

			await findUserOrThrow(userId);

			// insert into the associative tables
			try {
				const companiesSet = new Set<number>();
				if (accountData) {
					appLogger(`${accountData.length} accounts provided, inserting...`);
					await db.insert(userAccounts).values(
						accountData.map((acc) => ({
							...acc,
							userId,
						})),
					);
					appLogger(
						`${accountData.length} accounts inserted, getting companies...`,
					);
					const accountIds = accountData.map((a) => a.accountId);
					const companiesForAccounts = await db
						.selectDistinct({ companyId: accounts.companyId })
						.from(accounts)
						.where(inArray(accounts.id, accountIds));
					companiesForAccounts.forEach((companyData) => {
						if (companyData.companyId) {
							companiesSet.add(companyData.companyId);
						}
					});
				}
				if (cardData) {
					appLogger(`${cardData.length} card id's provided, inserting...`);
					await db.insert(userCards).values(
						cardData.map((d) => ({
							userId,
							cardId: d.cardId,
							cardLabel: d.cardLabel,
						})),
					);
					appLogger(
						`${cardData.length} card id's inserted, getting companies...`,
					);
					const cardIds = cardData.map((d) => d.cardId);
					const companiesForCards = await db
						.selectDistinct({ companyId: cards.companyId })
						.from(cards)
						.where(inArray(cards.id, cardIds));
					companiesForCards.forEach((companyData) => {
						if (companyData.companyId) {
							companiesSet.add(companyData.companyId);
						}
					});
				}
				appLogger(`${companiesSet.size} companies to be added`);

				// insert to user company associative table
				await db
					.insert(userCompanies)
					.values(
						[...companiesSet].map((id) => ({
							userId,
							companyId: id,
						})),
					)
					.onConflictDoNothing();
				return c.text(
					`Successfully added ${accountData?.length} accounts, ${cardData?.length} cards, and ${companiesSet.size} companies to user`,
				);
			} catch (e) {
				appLogger(`${e}`);
				if (e instanceof Error && e.message.includes("FOREIGN")) {
					throw new HTTPException(400, {
						message: "one of the ids provided does not exist!",
					});
				}
				throw new HTTPException(400, {
					message: `${e}`,
				});
			}
		},
	)
	.post("/assignTo/*", async (c) => {
		return c.text("Please specify a user id", 400);
	})
	.post(
		"/linkStatement",
		zodValidator("json", LinkStatementPayloadZ),
		async (c) => {
			const { identifier, cardId, accountId } = c.req.valid("json");
			const handleRes = (res: StatementOwnershipsSelectSchema[]) => {
				if (!res.length) {
					throw new HTTPException(500, {
						message: `Could not add ${cardId || accountId}`,
					});
				}
				if (res[0]) {
					return res[0];
				} else {
					throw new HTTPException(500, {
						message: `Could not add ${cardId || accountId}`,
					});
				}
			};
			let createdRes: StatementOwnershipsSelectSchema[] = [];
			if (cardId) {
				createdRes = await db
					.insert(statementOwnerships)
					.values({
						identifier,
						cardId,
					})
					.returning();
			}
			if (accountId) {
				createdRes = await db
					.insert(statementOwnerships)
					.values({
						identifier,
						accountId,
					})
					.returning();
			}
			return c.json({
				data: handleRes(createdRes),
			});
		},
	)
	.post("/fileUpload", zodValidator("form", fileUploadPayloadZ), async (c) => {
		const { file, userId } = c.req.valid("form");

		let statementData: Awaited<ReturnType<PdfParser>> | undefined;
		switch (file.type) {
			case "application/pdf":
				statementData = await pdfParser(file, userId);
				break;
			// case "application/vnd.ms-excel":
			//     console.log('I am xls')
			//     break;
			// case "text/csv":
			//     console.log('I am csv')
			//     break;
			default:
				// if zod validation fails somehow...
				throw new HTTPException(400, {
					message: `Unknown file type`,
				});
		}

		const taggedTransactions: Array<
			Array<
				TaggedTransaction & {
					accountName: string;
					cardId?: number | null;
					accountId?: number | null;
				}
			>
		> = [];
		const cardInfo: { cardId: number | undefined; cardName: string }[] = [];
		const accountInfo: {
			accountId: number | undefined;
			accountName: string;
		}[] = [];
		const statementInfo: StatementInfo = {
			statementDate: statementData.data.statementDate,
			statementOwnerIds: [],
		};
		const availableCards: Array<
			{ id: number; name: string; companyName: string }[] | undefined
		> = [];
		const availableAccounts: Array<
			{ id: number; name: string; companyName: string }[] | undefined
		> = [];

		switch (statementData.data.type) {
			case "card":
				for (const [parsedCardName, data] of Object.entries(
					statementData.data.cards,
				)) {
					const cardOwnerRes =
						await getStatementOwnerByIdentifier(parsedCardName);
					let cardName = parsedCardName;
					let cardId: number | undefined;
					const cardRes = await db
						.select({
							id: cards.id,
							name: cards.name,
							companyName: companies.name,
						})
						.from(cards)
						.innerJoin(companies, eq(companies.id, cards.companyId))
						.where(
							and(
								eq(companies.name, statementData.companyName),
								cardOwnerRes[0]?.cardId
									? eq(cards.id, cardOwnerRes[0].cardId)
									: undefined,
							),
						);
					if (cardOwnerRes[0] && cardRes[0]) {
						cardName = cardRes[0].name;
						cardId = cardRes[0].id;
						availableCards.push(undefined);
					} else if (cardRes.length < 1) {
						cardId = cardRes?.[0]?.id;
						availableCards.push(undefined);
					} else {
						availableCards.push(cardRes);
					}
					statementInfo.statementOwnerIds.push(cardOwnerRes?.[0]?.id);
					cardInfo.push({
						cardId,
						cardName,
					});

					const taggedTxns = await tagTransactions(data.transactions);
					const txnWithCardName = taggedTxns.map((t) => ({
						...t,
						accountName: cardName,
						cardId,
					}));
					taggedTransactions.push(txnWithCardName);
				}
				break;
			case "cpf":
			case "account":
				for (const [parsedAcctName, data] of Object.entries(
					statementData.data.accounts,
				)) {
					const accountOwnerRes =
						await getStatementOwnerByIdentifier(parsedAcctName);
					let accountName = parsedAcctName;
					let accountId: number | undefined;
					const accountRes = await db
						.select({
							id: accounts.id,
							name: accounts.name,
							companyName: companies.name,
						})
						.from(accounts)
						.innerJoin(companies, eq(companies.id, accounts.companyId))
						.where(
							and(
								eq(companies.name, statementData.companyName),
								accountOwnerRes[0]?.accountId
									? eq(accounts.id, accountOwnerRes[0].accountId)
									: undefined,
							),
						);
					if (accountOwnerRes[0] && accountRes[0]) {
						accountName = accountRes[0].name;
						accountId = accountRes[0].id;
						availableAccounts.push(undefined);
					} else if (accountRes.length < 1) {
						accountId = accountRes?.[0]?.id;
						availableAccounts.push(undefined);
					} else {
						availableAccounts.push(accountRes);
					}
					statementInfo.statementOwnerIds.push(accountOwnerRes?.[0]?.id);
					accountInfo.push({
						accountId,
						accountName,
					});

					const taggedTxns = await tagTransactions(data.transactions);
					const txnWithAccountName = taggedTxns.map((t) => ({
						...t,
						accountName,
						accountId,
					}));
					taggedTransactions.push(txnWithAccountName);
				}
				break;
			default:
				throw new HTTPException(500, { message: "Statement NOT IMPLEMENTED" });
		}

		const companyRes = await db
			.select()
			.from(companies)
			.where(eq(companies.name, statementData.companyName));
		if (!companyRes[0]) {
			throw new HTTPException(500, {
				message:
					"Error parsing statement: Unable to detect company from statement",
			});
		}

		return c.json({
			taggedTransactions,
			statementInfo,
			cardInfo,
			accountInfo,
			companyId: companyRes[0].id,
			availableAccounts,
			availableCards,
		});
	})
	.get("/availableInventory/:userId", async (c) => {
		const { userId } = c.req.param();

		const allCardRows = await db
			.select()
			.from(companies)
			.leftJoin(cards, eq(companies.id, cards.companyId))
			.leftJoin(
				userCards,
				and(eq(cards.id, userCards.cardId), eq(userCards.userId, userId)),
			);

		const userCardRows = allCardRows.filter((row) => row.user_cards);

		const userCardRowsWithAmount = userCardRows.map((row) => {
			if (!row.user_cards) return { ...row, total: 0 };
			const queryRes = db
				.select({ totalAmount: sql<number>`sum(${transactions.amount})` })
				.from(transactions)
				.where(
					and(
						eq(transactions.cardId, row.user_cards.cardId),
						eq(transactions.userId, row.user_cards.userId),
					),
				)
				.all();
			return {
				...row,
				total: queryRes[0]?.totalAmount,
			};
		});

		const allAccountRows = await db
			.select()
			.from(companies)
			.leftJoin(accounts, eq(companies.id, accounts.companyId))
			.leftJoin(
				userAccounts,
				and(
					eq(userAccounts.accountId, accounts.id),
					eq(userAccounts.userId, userId),
				),
			);

		const userAccountRows = allAccountRows.filter((row) => row.user_accounts);
		const userAccountRowsWithAmount = userAccountRows.map((row) => {
			if (!row.user_accounts) return { ...row, total: 0 };
			const queryRes = db
				.select({ totalAmount: sql<number>`sum(${transactions.amount})` })
				.from(transactions)
				.where(
					and(
						eq(transactions.accountId, row.user_accounts.accountId),
						eq(transactions.userId, row.user_accounts.userId),
					),
				)
				.all();
			return {
				...row,
				total: queryRes[0]?.totalAmount,
			};
		});

		return c.json({
			allAccounts: allAccountRows,
			allCards: allCardRows,
			userCards: userCardRowsWithAmount,
			userAccounts: userAccountRowsWithAmount,
		});
	});

export type UiRouteType = typeof uiRoute;
