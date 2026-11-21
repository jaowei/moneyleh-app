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
import { findUserOrThrow } from "./route.utils.ts";
import {
	type AvailableEntity,
	attachKnownSecurities,
	getEntityFromParsedNames,
	type PortfolioHolding,
} from "./ui.utils.ts";

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
		// One entry per tab, parallel to `taggedTransactions` / `cardInfo` /
		// `accountInfo`. Non-broker statements get an empty entry for each tab.
		const portfolio: PortfolioHolding[][] = [];
		const cardInfo: { cardId: number | undefined; cardName: string }[] = [];
		const accountInfo: {
			accountId: number | undefined;
			accountName: string;
		}[] = [];
		const statementInfo: StatementInfo = {
			statementDate: statementData.data.statementDate,
			statementOwnerIds: [],
		};
		const availableCards: Array<AvailableEntity[] | undefined> = [];
		const availableAccounts: Array<AvailableEntity[] | undefined> = [];

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
		const companyId = companyRes[0].id;

		switch (statementData.data.type) {
			case "card":
				for (const [parsedCardName, data] of Object.entries(
					statementData.data.cards,
				)) {
					let cardName = parsedCardName;
					let cardId: number | undefined;
					const res = await getEntityFromParsedNames(
						cardName,
						statementData.companyName,
						"card",
					);
					if (res.found === false) {
						availableCards.push(res.availableEntities);
						statementInfo.statementOwnerIds.push(undefined);
					} else {
						availableCards.push(undefined);
						statementInfo.statementOwnerIds.push(res.linkId);
						cardName = res.name;
						cardId = res.entityId;
					}
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
					portfolio.push([]);
				}
				break;
			case "cpf":
			case "account":
				for (const [parsedAcctName, data] of Object.entries(
					statementData.data.accounts,
				)) {
					let accountName = parsedAcctName;
					let accountId: number | undefined;
					const res = await getEntityFromParsedNames(
						accountName,
						statementData.companyName,
						"account",
					);
					if (res.found === false) {
						availableAccounts.push(res.availableEntities);
						statementInfo.statementOwnerIds.push(undefined);
					} else {
						availableAccounts.push(undefined);
						statementInfo.statementOwnerIds.push(res.linkId);
						accountName = res.name;
						accountId = res.entityId;
					}
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
					portfolio.push([]);
				}
				break;
			case "broker": {
				let accountName: string = statementData.data.name;
				let accountId: number | undefined;
				const res = await getEntityFromParsedNames(
					accountName,
					statementData.companyName,
					"account",
				);
				if (res.found === false) {
					availableAccounts.push(res.availableEntities);
					statementInfo.statementOwnerIds.push(undefined);
				} else {
					availableAccounts.push(undefined);
					statementInfo.statementOwnerIds.push(res.linkId);
					accountName = res.name;
					accountId = res.entityId;
				}
				accountInfo.push({
					accountId,
					accountName,
				});
				const taggedTxns = await tagTransactions(
					statementData.data.transactions,
				);
				const txnWithAccountName = taggedTxns.map((t) => ({
					...t,
					accountName,
					accountId,
				}));
				taggedTransactions.push(txnWithAccountName);
				portfolio.push(
					await attachKnownSecurities(companyId, statementData.data.portfolio),
				);

				break;
			}
			default:
				throw new HTTPException(500, { message: "Statement NOT IMPLEMENTED" });
		}

		return c.json({
			statementType: statementData.data.type,
			taggedTransactions,
			portfolio,
			statementInfo,
			cardInfo,
			accountInfo,
			companyId,
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
