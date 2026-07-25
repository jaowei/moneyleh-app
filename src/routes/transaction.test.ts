import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	test,
} from "bun:test";
import { and, eq, inArray, like } from "drizzle-orm";
import { user } from "../db/auth-schema.ts";
import { db } from "../db/db.ts";
import {
	statements,
	type TransactionsUpdateSchema,
	tags,
	transactionShares,
	transactionStatements,
	transactions,
	transactionTags,
	userAccounts,
	userCards,
} from "../db/schema.ts";
import app from "../index.ts";
import { jsonHeader, testUser, testUser2 } from "../lib/test.utils.ts";
import type {
	PatchTransactionPayload,
	PostTransactionPayload,
} from "./transaction.ts";

describe("/api/transaction", () => {
	db.run("PRAGMA busy_timeout = 5000;");
	const fixedDate = "fixed-date";
	const testTransaction = {
		transactionDate: fixedDate,
		description: "test-description",
		currency: "SGD",
		amount: 123,
		userId: testUser.id,
		accountId: 1,
	};

	const transactionCleanup = async () => {
		try {
			const txnToDelete = await db
				.select()
				.from(transactions)
				.where(eq(transactions.userId, testUser.id));
			if (txnToDelete.length) {
				for (const target of txnToDelete) {
					console.log("----- Deleting transaction!");
					await db
						.delete(transactionTags)
						.where(eq(transactionTags.transactionId, target.id));
					await db
						.delete(transactionStatements)
						.where(eq(transactionStatements.transactionId, target.id));
					await db
						.delete(transactionShares)
						.where(eq(transactionShares.transactionId, target.id));
				}
				await db
					.delete(transactions)
					.where(eq(transactions.transactionDate, fixedDate));
			}
		} catch (e) {
			console.log("Error deleting", e);
			console.log(
				"You probably need to delete a row from transactionsTag table",
			);
		}
	};

	const statementCleanup = async () => {
		const results = await db
			.select()
			.from(statements)
			.where(eq(statements.userId, testUser.id));
		const statementIds = results.map((r) => r.id);
		await db
			.delete(transactionStatements)
			.where(inArray(transactionStatements.statementId, statementIds));
		await db.delete(statements).where(inArray(statements.id, statementIds));
	};

	const assignmentCleanup = async () => {
		await db.delete(userCards).where(eq(userCards.userId, testUser.id));
		await db.delete(userAccounts).where(eq(userAccounts.userId, testUser.id));
	};

	describe("create", () => {
		let splitTestTag: { id: number; description: string };
		beforeAll(async () => {
			await db.insert(user).values(testUser2).onConflictDoNothing();
			const inserted = await db
				.insert(tags)
				.values({ description: "split-test-tag" })
				.onConflictDoNothing()
				.returning();
			if (inserted[0]) {
				splitTestTag = inserted[0];
			} else {
				const existing = await db
					.select()
					.from(tags)
					.where(eq(tags.description, "split-test-tag"));
				splitTestTag = existing[0]!;
			}
		});
		afterAll(async () => {
			await db.delete(tags).where(eq(tags.id, splitTestTag.id));
		});
		afterEach(async () => {
			await transactionCleanup();
			await statementCleanup();
		});

		test("inserts when transactions are similar in the same statement", async () => {
			const testPayload: PostTransactionPayload = {
				transactions: [testTransaction, testTransaction],
				statementInfo: {
					statementDate: new Date().toISOString(),
					statementOwnershipId: 1,
				},
				accountInfo: { accountId: 1, accountName: "test-account" },
				companyId: 1,
			};
			const res = await app.request("/api/transaction", {
				method: "POST",
				body: JSON.stringify(testPayload),
				...jsonHeader,
			});
			expect(res.status).toBe(201);
		});

		test("does not insert into db: no transactions", async () => {
			const res = await app.request("/api/transaction", {
				method: "POST",
				body: JSON.stringify({
					transactions: [],
					statementInfo: { statementDate: new Date().toISOString() },
					accountInfo: { accountId: 1, accountName: "test-account" },
				}),
				...jsonHeader,
			});
			expect(res.status).toBe(400);
		});

		test("inserts into db: no tags", async () => {
			const testTransactions: PostTransactionPayload = {
				transactions: [testTransaction],
				statementInfo: {
					statementDate: new Date().toISOString(),
					statementOwnershipId: 1,
				},
				accountInfo: { accountId: 1, accountName: "test-account" },
				companyId: 1,
			};
			const res = await app.request("/api/transaction", {
				method: "POST",
				body: JSON.stringify(testTransactions),
				...jsonHeader,
			});
			expect(res.status).toBe(201);
		});

		test("does not insert into db: invalid tag", async () => {
			const testTransactions: PostTransactionPayload = {
				transactions: [
					{
						...testTransaction,
						tags: [
							{
								id: -1,
								description: "",
							},
						],
					},
				],
				statementInfo: {
					statementDate: new Date().toISOString(),
					statementOwnershipId: 1,
				},
				accountInfo: { accountId: 1, accountName: "test-account" },
				companyId: 1,
			};
			const res = await app.request("/api/transaction", {
				method: "POST",
				body: JSON.stringify(testTransactions),
				...jsonHeader,
			});
			expect(res.status).toBe(400);
			expect(await res.text()).toInclude("Too small");
		});

		test("does not insert into db: tag not in db", async () => {
			const testTransactions: PostTransactionPayload = {
				transactions: [
					{
						...testTransaction,
						tags: [
							{
								id: 100000,
								description: "some-random-tag",
							},
						],
					},
				],
				statementInfo: {
					statementDate: new Date().toISOString(),
					statementOwnershipId: 1,
				},
				accountInfo: { accountId: 1, accountName: "test-account" },
				companyId: 1,
			};
			const res = await app.request("/api/transaction", {
				method: "POST",
				body: JSON.stringify(testTransactions),
				...jsonHeader,
			});
			expect(res.status).toBe(400);
			expect(await res.text()).toInclude("Tag does not exist");
		});

		test("inserts into db: only once, test db transaction", async () => {
			const testTransactions: PostTransactionPayload = {
				transactions: [
					{
						...testTransaction,
						transactionDate: fixedDate,
						tags: [],
					},
				],
				statementInfo: {
					statementDate: new Date().toISOString(),
					statementOwnershipId: 1,
				},
				accountInfo: { accountId: 1, accountName: "test-account" },
				companyId: 1,
			};
			const res = await app.request("/api/transaction", {
				method: "POST",
				body: JSON.stringify(testTransactions),
				...jsonHeader,
			});
			expect(res.status).toBe(201);

			const txnNotAdded = {
				...testTransaction,
				amount: 777,
				description: "desc2",
			};
			const secondRes = await app.request("/api/transaction", {
				method: "POST",
				body: JSON.stringify({
					...testTransactions,
					transactions: [txnNotAdded, ...testTransactions.transactions],
					accountInfo: { accountId: 1, accountName: "test-account" },
				}),
				...jsonHeader,
			});
			expect(secondRes.status).toBe(400);
			const errText = await secondRes.text();
			expect(errText).toInclude("already added");
			expect(errText).toInclude("Statement");
			const queryRes = db
				.select()
				.from(transactions)
				.where(
					and(
						eq(transactions.amount, txnNotAdded.amount),
						eq(transactions.description, txnNotAdded.description),
					),
				)
				.all();
			expect(queryRes.length).toBe(0);
		});

		test("does not insert into db: invalid payload", async () => {
			const testTransactions: PostTransactionPayload = {
				transactions: [
					{
						...testTransaction,
						tags: [],
						cardId: 1,
					},
				],
				statementInfo: {
					statementDate: new Date().toISOString(),
					statementOwnershipId: 1,
				},
				cardInfo: { cardId: 1, cardName: "test-card" },
				companyId: 1,
			};
			const res = await app.request("/api/transaction", {
				method: "POST",
				body: JSON.stringify(testTransactions),
				...jsonHeader,
			});
			expect(res.status).toBe(400);
			expect(await res.text()).toInclude("both cannot be empty and filled");
		});

		test("inserts into db: with split and no tags", async () => {
			const testTransactions: PostTransactionPayload = {
				transactions: [
					{
						...testTransaction,
						tags: [],
						split: {
							share: 50,
							userId: testUser2.id,
						},
					},
				],
				statementInfo: {
					statementDate: new Date().toISOString(),
					statementOwnershipId: 1,
				},
				accountInfo: { accountId: 1, accountName: "test-account" },
				companyId: 1,
			};
			const res = await app.request("/api/transaction", {
				method: "POST",
				body: JSON.stringify(testTransactions),
				...jsonHeader,
			});
			expect(res.status).toBe(201);

			const insertedTxns = await db
				.select()
				.from(transactions)
				.where(
					and(
						eq(transactions.userId, testUser.id),
						eq(transactions.description, testTransaction.description),
					),
				);
			expect(insertedTxns.length).toBe(1);

			if (!insertedTxns[0]) throw new Error();

			const shares = await db
				.select()
				.from(transactionShares)
				.where(eq(transactionShares.transactionId, insertedTxns[0].id));
			expect(shares.length).toBe(2);

			const otherUserShare = shares.find((s) => s.userId === testUser2.id);
			expect(otherUserShare).toBeDefined();
			expect(otherUserShare?.share).toBe(50);

			const insertingUserShare = shares.find((s) => s.userId === testUser.id);
			expect(insertingUserShare).toBeDefined();
			expect(insertingUserShare?.share).toBe(50);
		});

		test("inserts into db: with split and tags", async () => {
			const testTransactions: PostTransactionPayload = {
				transactions: [
					{
						...testTransaction,
						split: {
							share: 70,
							userId: testUser2.id,
						},
						tags: [
							{ id: splitTestTag.id, description: splitTestTag.description },
						],
					},
				],
				statementInfo: {
					statementDate: new Date().toISOString(),
					statementOwnershipId: 1,
				},
				accountInfo: { accountId: 1, accountName: "test-account" },
				companyId: 1,
			};
			const res = await app.request("/api/transaction", {
				method: "POST",
				body: JSON.stringify(testTransactions),
				...jsonHeader,
			});
			expect(res.status).toBe(201);

			const insertedTxns = await db
				.select()
				.from(transactions)
				.where(
					and(
						eq(transactions.userId, testUser.id),
						eq(transactions.description, testTransaction.description),
					),
				);
			expect(insertedTxns.length).toBe(1);
			if (!insertedTxns[0]) throw new Error();

			const shares = await db
				.select()
				.from(transactionShares)
				.where(eq(transactionShares.transactionId, insertedTxns[0].id));
			expect(shares.length).toBe(2);

			const otherUserShare = shares.find((s) => s.userId === testUser2.id);
			expect(otherUserShare).toBeDefined();
			expect(otherUserShare?.share).toBe(70);

			const insertingUserShare = shares.find((s) => s.userId === testUser.id);
			expect(insertingUserShare).toBeDefined();
			expect(insertingUserShare?.share).toBe(30);

			const txnTags = await db
				.select()
				.from(transactionTags)
				.where(eq(transactionTags.transactionId, insertedTxns[0].id));
			expect(txnTags.length).toBe(1);
			expect(txnTags[0]?.tagId).toBe(splitTestTag.id);
		});
	});

	describe("create then get", () => {
		afterAll(async () => {
			await transactionCleanup();
			await statementCleanup();
			await assignmentCleanup();
		});

		test("inserts into db", async () => {
			const testTransactions: PostTransactionPayload = {
				transactions: [
					testTransaction,
					{
						...testTransaction,
						accountId: undefined,
						amount: 1234,
						cardId: 1,
					},
				],
				statementInfo: {
					statementDate: new Date().toISOString(),
					statementOwnershipId: 1,
				},
				cardInfo: { cardId: 1, cardName: "test-card" },
				companyId: 1,
			};
			const res = await app.request("/api/transaction", {
				method: "POST",
				body: JSON.stringify(testTransactions),
				...jsonHeader,
			});
			expect(res.status).toBe(201);
		});

		test("get per user per account", async () => {
			const res = await app.request(
				`/api/transaction/${testUser.id}?type=account&accountId=1`,
				{
					method: "GET",
				},
			);
			expect(res.status).toBe(200);
			const resData = (await res.json()) as { transactions: any[] };
			expect(resData.transactions.length).toBe(1);
			expect(resData.transactions[0].accountName).toBe("multiplier");
		});

		test("get per user per card", async () => {
			const res = await app.request(
				`/api/transaction/${testUser.id}?type=card&cardId=1`,
				{
					method: "GET",
				},
			);
			expect(res.status).toBe(200);
			const resData = (await res.json()) as { transactions: any[] };
			expect(resData.transactions.length).toBe(1);
			expect(resData.transactions[0].cardName).toBe("altitude visa signature");
		});
	});

	describe("get transactions", () => {
		const accountId = 1;
		beforeAll(async () => {
			const testTxn = {
				id: 9999,
				transactionDate: "2020-12-31T16:00:00.000Z",
				amount: 100,
				description: "test-description",
				currency: "SGD",
				userId: testUser.id,
				accountId,
			};
			await db
				.insert(transactions)
				.values([
					testTxn,
					{
						...testTxn,
						currency: "USD",
						id: 9998,
						transactionDate: "2021-12-31T16:00:00.000Z",
					},
					{
						...testTxn,
						id: 99997,
						transactionDate: "2021-01-31T16:00:00.000Z",
					},
				])
				.onConflictDoNothing();
		});
		afterAll(async () => {
			await db.delete(transactions).where(eq(transactions.userId, testUser.id));
		});
		test("get for an invalid user", async () => {
			const res = await app.request(
				`/api/transaction/invalidUserId?type=card&cardId=1`,
				{
					method: "GET",
				},
			);
			expect(res.status).toBe(404);
		});

		test("get per user invalid query", async () => {
			const res = await app.request(
				`/api/transaction/${testUser.id}?type=card&accountId=${accountId}`,
				{
					method: "GET",
				},
			);
			expect(res.status).toBe(400);
			expect(await res.text()).toInclude("received NaN");
		});

		test("get per user missing some id param", async () => {
			const res = await app.request(
				`/api/transaction/${testUser.id}?type=card`,
				{
					method: "GET",
				},
			);
			expect(res.status).toBe(400);
			expect(await res.text()).toInclude("received NaN");
		});

		test("get per user missing type param", async () => {
			const res = await app.request(
				`/api/transaction/${testUser.id}?accountId=${accountId}`,
				{
					method: "GET",
				},
			);
			expect(res.status).toBe(400);
			expect(await res.text()).toInclude("Invalid discriminator value");
		});

		test("get per user no transactions per filter", async () => {
			const res = await app.request(
				`/api/transaction/${testUser.id}?type=account&accountId=1000`,
				{
					method: "GET",
				},
			);
			expect(res.status).toBe(200);
			const resData = (await res.json()) as any;
			expect(resData.transactions).toBeArrayOfSize(0);
		});

		test("get per user: transactions", async () => {
			const res = await app.request(
				`/api/transaction/${testUser.id}?type=account&accountId=${accountId}`,
				{
					method: "GET",
				},
			);
			expect(res.status).toBe(200);
			const resData = (await res.json()) as any;
			expect(resData.transactions).toBeArrayOfSize(3);
			expect(resData.transactionCount).toBe(3);
			expect(resData.valueByCurrency).toHaveProperty("SGD");
			expect(resData.valueByCurrency).toHaveProperty("USD");
			expect(resData.chartData).toMatchObject({
				SGD: {
					labels: ["2020-12", "2021-01"],
					movementValues: [100, 100],
					balanceValues: [100, 200],
				},
				USD: {
					labels: ["2021-12"],
					movementValues: [100],
					balanceValues: [100],
				},
			});
		});
	});

	describe("update transactions", () => {
		const testDate = "test-date";
		const testTagName = "test-tag-txn";
		afterEach(async () => {
			const testTxn = await db
				.select()
				.from(transactions)
				.where(eq(transactions.transactionDate, testDate));
			for (const t of testTxn) {
				await db
					.delete(transactionTags)
					.where(eq(transactionTags.transactionId, t.id));
				await db
					.delete(transactions)
					.where(eq(transactions.transactionDate, testDate));
			}
			await db.delete(tags).where(like(tags.description, `%${testTagName}%`));
		});
		test("update a transaction", async () => {
			const testTag = await db
				.insert(tags)
				.values({ description: `${testTagName}1` })
				.returning();
			const testTag2 = await db
				.insert(tags)
				.values({ description: `${testTagName}2` })
				.returning();
			const testTransaction = await db
				.insert(transactions)
				.values({
					transactionDate: testDate,
					amount: 0,
					description: "test-description",
					currency: "SGD",
					userId: testUser.id,
				})
				.returning();
			if (!testTransaction[0]) throw new Error("did not make test transaction");
			if (!testTag[0]) throw new Error("did not make test transaction");
			if (!testTag2[0]) throw new Error("did not make test transaction");
			await db
				.insert(transactionTags)
				.values({ transactionId: testTransaction[0].id, tagId: testTag[0].id });
			const transactionUpdatePayload: PatchTransactionPayload["transactions"][0] =
				{
					id: testTransaction[0].id,
					amount: 999,
					description: "I was updated!",
					tags: [
						{
							id: testTag[0].id,
							description: "test-tag",
						},
						{ id: testTag2[0].id, description: "test-tag2" },
					],
				};
			const res = await app.request(`/api/transaction/${testUser.id}`, {
				method: "PATCH",
				body: JSON.stringify({
					transactions: [transactionUpdatePayload],
				}),
				...jsonHeader,
			});
			const transactionAfter = await db
				.select()
				.from(transactions)
				.where(eq(transactions.id, testTransaction[0].id));
			const transactionTagAfter = await db
				.select()
				.from(transactionTags)
				.where(eq(transactionTags.transactionId, testTransaction[0].id));
			expect(res.status).toBe(200);
			expect(transactionAfter[0]?.description).toBe(
				transactionUpdatePayload.description,
			);
			expect(transactionAfter[0]?.amount).toBe(transactionUpdatePayload.amount);
			expect(transactionTagAfter.length).toBe(2);
		});
		test("fails update when tag is invalid", async () => {
			const testTransaction = await db
				.insert(transactions)
				.values({
					transactionDate: testDate,
					amount: 0,
					description: "test-description",
					currency: "SGD",
					userId: testUser.id,
				})
				.returning();
			if (!testTransaction[0]) throw new Error("did not make test transaction");
			const transactionUpdatePayload: PatchTransactionPayload["transactions"][0] =
				{
					id: testTransaction[0].id,
					amount: 999,
					description: "I was updated!",
					tags: [
						{
							id: 0,
							description: "test-tag",
						},
					],
				};
			const res = await app.request(`/api/transaction/${testUser.id}`, {
				method: "PATCH",
				body: JSON.stringify({
					transactions: [transactionUpdatePayload],
				}),
				...jsonHeader,
			});
			const transactionTagAfter = await db
				.select()
				.from(transactionTags)
				.where(eq(transactionTags.transactionId, testTransaction[0].id));
			expect(res.status).toBe(400);
			expect(await res.text()).toInclude("Could not update tag");
			expect(transactionTagAfter.length).toBe(0);
		});
		test("fails on invalid transaction id", async () => {
			await db.insert(transactions).values({
				transactionDate: testDate,
				amount: 0,
				description: "test-description",
				currency: "SGD",
				userId: testUser.id,
			});
			const transactionUpdatePayload: TransactionsUpdateSchema = {
				id: 1000,
				amount: 999,
				description: "I was updated!",
			};
			const res = await app.request(`/api/transaction/${testUser.id}`, {
				method: "PATCH",
				body: JSON.stringify({
					transactions: [
						{
							...transactionUpdatePayload,
							id: 100000,
						},
					],
				}),
				...jsonHeader,
			});
			expect(res.status).toBe(400);
			expect(await res.text()).toInclude("Could not update transaction");
		});
		test("fails when no transaction id is available", async () => {
			const transactionUpdatePayload: TransactionsUpdateSchema = {
				amount: 999,
				description: "I was updated!",
			};
			const res = await app.request(`/api/transaction/${testUser.id}`, {
				method: "PATCH",
				body: JSON.stringify({
					transactions: [transactionUpdatePayload],
				}),
				...jsonHeader,
			});
			expect(res.status).toBe(400);
			expect(await res.text()).toInclude("Invalid input");
		});
		test("fails when mixed valid and invalid transactions", async () => {
			const newTransaction = {
				transactionDate: testDate,
				amount: 0,
				description: "test-description",
				currency: "SGD",
				userId: testUser.id,
			};
			const testTransaction = await db
				.insert(transactions)
				.values(newTransaction)
				.returning();
			const transactionUpdatePayload: TransactionsUpdateSchema = {
				id: testTransaction?.[0]?.id,
				amount: 999,
				description: "I was updated!",
			};
			const res = await app.request(`/api/transaction/${testUser.id}`, {
				method: "PATCH",
				body: JSON.stringify({
					transactions: [
						transactionUpdatePayload,
						{ ...transactionUpdatePayload, id: -1 },
					],
				}),
				...jsonHeader,
			});
			const result = await db
				.select()
				.from(transactions)
				.where(eq(transactions.id, testTransaction?.[0]?.id || 0));
			expect(res.status).toBe(400);
			expect(result?.[0]?.amount).toBe(newTransaction.amount);
			expect(await res.text()).toInclude("Could not update transaction");
		});
	});

	describe("create per card/account", () => {
		test("fails to insert into db: invalid file", async () => {
			const formData = new FormData();
			const testFile = Bun.file("./test-files/dbsCard.pdf");
			formData.append("file", testFile);
			formData.append("userId", testUser.id);
			formData.append("accountId", "1");
			const res = await app.request("/api/transaction/csv", {
				method: "POST",
				body: formData,
			});
			expect(res.status).toBe(400);
			expect(await res.text()).toInclude("text/csv");
		});

		test("fails to insert into db: no account/card id", async () => {
			const formData = new FormData();
			const testFile = Bun.file("./test-files/migrationTest.csv");
			formData.append("file", testFile);
			formData.append("userId", testUser.id);
			const res = await app.request("/api/transaction/csv", {
				method: "POST",
				body: formData,
			});
			expect(res.status).toBe(400);
			expect(await res.text()).toInclude(
				"An account id or card id is required",
			);
		});

		test("fails to insert into db: both account/card id", async () => {
			const formData = new FormData();
			const testFile = Bun.file("./test-files/migrationTest.csv");
			formData.append("file", testFile);
			formData.append("userId", testUser.id);
			formData.append("accountId", "1");
			formData.append("cardId", "1");
			const res = await app.request("/api/transaction/csv", {
				method: "POST",
				body: formData,
			});
			expect(res.status).toBe(400);
			expect(await res.text()).toInclude(
				"An account id or card id is required",
			);
		});

		test("fails to insert into db: unknown user", async () => {
			const formData = new FormData();
			const testFile = Bun.file("./test-files/migrationTest.csv");
			formData.append("file", testFile);
			formData.append("userId", "whoareyou");
			formData.append("cardId", "1");
			const res = await app.request("/api/transaction/csv", {
				method: "POST",
				body: formData,
			});
			expect(res.status).toBe(404);
			expect(await res.text()).toInclude("not found");
		});

		test("fails to insert into db: account/card not assigned", async () => {
			const formData = new FormData();
			const testFile = Bun.file("./test-files/migrationTest.csv");
			formData.append("file", testFile);
			formData.append("userId", testUser.id);
			formData.append("accountId", "100000");
			const res = await app.request("/api/transaction/csv", {
				method: "POST",
				body: formData,
			});
			expect(res.status).toBe(400);
			expect(await res.text()).toInclude("has not been assigned");
		});

		describe("insert and delete all", () => {
			afterAll(async () => {
				const testTxns = await db
					.select()
					.from(transactions)
					.where(eq(transactions.userId, testUser.id));
				const testTxnIds = testTxns.map((t) => t.id);
				await db
					.delete(transactionTags)
					.where(inArray(transactionTags.transactionId, testTxnIds));
				await db
					.delete(transactionStatements)
					.where(inArray(transactionStatements.transactionId, testTxnIds));
				await db
					.delete(transactions)
					.where(eq(transactions.userId, testUser.id));
				await db
					.delete(userAccounts)
					.where(eq(userAccounts.userId, testUser.id));
			});
			test("inserts into db", async () => {
				const accountId = 1;
				await db
					.insert(userAccounts)
					.values({
						userId: testUser.id,
						accountId,
					})
					.onConflictDoNothing();
				const formData = new FormData();
				const testFile = Bun.file("./test-files/migrationTest.csv");
				formData.append("file", testFile);
				formData.append("userId", testUser.id);
				formData.append("accountId", `${accountId}`);
				const res = await app.request("/api/transaction/csv", {
					method: "POST",
					body: formData,
				});
				expect(res.status).toBe(201);
				const sampleTxns = db
					.select()
					.from(transactions)
					.where(eq(transactions.userId, testUser.id))
					.limit(5)
					.all();
				expect(sampleTxns?.[0]?.userId).toBe(testUser.id);
			});
		});
	});
});
