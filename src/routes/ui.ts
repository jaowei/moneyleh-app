import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { db } from "../db/db.ts";
import {
	accounts,
	cards,
	companies,
	userAccountInsertSchemaZ,
	userAccounts,
	userCardInsertSchemaZ,
	userCards,
	userCompanies,
} from "../db/schema.ts";
import { appLogger } from "../index.ts";
import {
	type TaggedTransaction,
	tagTransactions,
} from "../lib/descriptionTagger/descriptionTagger.ts";
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
	// min 5kb, max 150kb
	userId: z.string(),
	file: z
		.file()
		.mime(["application/pdf"])
		.min(1 * 1000)
		.max(300 * 1000),
});

export const statementInfoZ = z.object({
	statementDate: z.string(),
	statementOwnerIds: z.array(z.number()),
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
		switch (statementData.data.type) {
			case "card":
				for (const [parsedCardName, data] of Object.entries(
					statementData.data.cards,
				)) {
					const cardOwnerRes =
						await getStatementOwnerByIdentifier(parsedCardName);
					let cardName = parsedCardName;
					let cardId: number | undefined;
					if (cardOwnerRes[0]?.cardId) {
						statementInfo.statementOwnerIds.push(cardOwnerRes[0].id);
						const cardRes = await db
							.select({
								id: cards.id,
								name: cards.name,
								companyName: companies.name,
							})
							.from(cards)
							.leftJoin(companies, eq(companies.id, cards.companyId))
							.where(
								and(
									eq(companies.name, statementData.companyName),
									eq(cards.id, cardOwnerRes[0].cardId),
								),
							);
						cardId = cardRes?.[0]?.id;
						if (cardRes[0]) {
							cardName = cardRes[0].name;
						}
					} else {
						throw new HTTPException(500, {
							message: `Statement parsed name not linked to card (${parsedCardName}), contact developer to get it linked`,
						});
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
					if (accountOwnerRes[0]?.accountId) {
						statementInfo.statementOwnerIds.push(accountOwnerRes[0].id);
						const accountRes = await db
							.select({
								id: accounts.id,
								name: accounts.name,
								companyName: companies.name,
							})
							.from(accounts)
							.leftJoin(companies, eq(companies.id, accounts.companyId))
							.where(
								and(
									eq(companies.name, statementData.companyName),
									eq(accounts.id, accountOwnerRes[0].accountId),
								),
							);
						accountId = accountRes?.[0]?.id;
						if (accountRes[0]) {
							accountName = accountRes[0].name;
						}
					} else {
						throw new HTTPException(500, {
							message: `Statement parsed name not linked to account (${parsedAcctName}), contact developer to get it linked`,
						});
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

		return c.json({
			allAccounts: allAccountRows,
			allCards: allCardRows,
			userCards: userCardRows,
			userAccounts: userAccountRows,
		});
	});

export type UiRouteType = typeof uiRoute;
