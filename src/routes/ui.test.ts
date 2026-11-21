import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	jest,
	test,
} from "bun:test";
import { and, eq, inArray, like } from "drizzle-orm";
import { db } from "../db/db.ts";
import {
	companies,
	securities,
	securityToStatementMappers,
	statementOwnerships,
	statements,
	type UserAccountsInsertSchema,
	type UserCardInsertSchema,
	userAccounts,
	userCards,
} from "../db/schema.ts";
import app from "../index.ts";
import { jsonHeader, testUser } from "../lib/test.utils.ts";

describe("/api/ui", () => {
	afterEach(async () => {
		await db.delete(userCards).where(eq(userCards.userId, testUser.id));
		await db.delete(userAccounts).where(eq(userAccounts.userId, testUser.id));
		await db.delete(statements).where(eq(statements.userId, testUser.id));
	});
	describe("upload and handle files", () => {
		beforeAll(async () => {
			await db.delete(userCards).where(eq(userCards.userId, testUser.id));
		});
		afterEach(() => {
			jest.restoreAllMocks();
		});
		const getCompleteFormData = (filePath: string) => {
			const formData = new FormData();
			const testFile = Bun.file(filePath);
			formData.append("file", testFile);
			formData.append("userId", testUser.id);
			return formData;
		};
		test("file upload: parse transactions card dbs", async () => {
			const formData = getCompleteFormData("./test-files/dbsCard.pdf");
			const res = await app.request("/api/ui/fileUpload", {
				method: "POST",
				body: formData,
			});
			expect(res.status).toBe(200);
			// TODO: unable to get Hono test client working, to figure out how to get typesafe testing
			const result = (await res.json()) as any;
			expect(result).toHaveProperty("taggedTransactions");
			expect(result.taggedTransactions.length).toBe(2);
			expect(result.taggedTransactions[0].length).toBe(23);
			expect(result.taggedTransactions[1].length).toBe(20);
			expect(result.statementInfo.statementDate.length).toBeGreaterThan(1);
			expect(result.statementInfo.statementOwnerIds.length).toBeGreaterThan(1);
			expect(result.availableCards.length).toBe(2);
			expect(result.availableCards[0]).toBe(null);
			expect(result.availableAccounts.length).toBe(0);
			expect(result.companyId).toBeTruthy();
			expect(result.accountInfo.length).toBe(0);
			expect(result.cardInfo.length).toBe(2);
			expect(result.cardInfo[0].cardId).toBeNumber();
			expect(result.cardInfo[0].cardName).toBeString();
			// Portfolio stays parallel to the tabs, empty for card statements.
			expect(result.portfolio).toBeArrayOfSize(2);
			expect(result.portfolio[0]).toBeArrayOfSize(0);
			expect(result.portfolio[1]).toBeArrayOfSize(0);
		});
		test("file upload: parse transactions account dbs", async () => {
			const formData = getCompleteFormData(
				"./test-files/dbsAccountStatement.pdf",
			);
			const res = await app.request("/api/ui/fileUpload", {
				method: "POST",
				body: formData,
			});
			expect(res.status).toBe(200);
			const result = (await res.json()) as any;
			expect(result.taggedTransactions).toBeArrayOfSize(2);
			expect(result.taggedTransactions[0].length).toBe(33);
			expect(result.taggedTransactions[1].length).toBe(0);
			expect(result.portfolio).toBeArrayOfSize(2);
			expect(result.portfolio[0]).toBeArrayOfSize(0);
		});
		test("file upload: parse transactions account cpf", async () => {
			const formData = getCompleteFormData("./test-files/cpf.pdf");
			const res = await app.request("/api/ui/fileUpload", {
				method: "POST",
				body: formData,
			});
			expect(res.status).toBe(200);
			const result = (await res.json()) as { taggedTransactions: any[] };
			expect(result.taggedTransactions).toBeArrayOfSize(3);
			expect(result.taggedTransactions[0].length).toBe(2);
			expect(result.taggedTransactions[1].length).toBe(1);
			expect(result.taggedTransactions[2].length).toBe(3);
		});
		test("file upload: parse portfolio broker (chocolate)", async () => {
			const fundNames = [
				"Dimensional Global Short-Term Investment Grade Fixed Income Fund (DSF)",
				"UOBAM United SGD Fund (USF)",
				"Lion Global Short Duration Bond Fund (LGF)",
				"Fullerton Short Term Interest Rate Fund (FST)",
				"Nikko AM Shenton Short Term Bond Fund (NST)",
			];
			const securitiesBefore = await db
				.select({ id: securities.id })
				.from(securities)
				.where(inArray(securities.name, fundNames));

			const formData = getCompleteFormData("./test-files/chocolate.pdf");
			const res = await app.request("/api/ui/fileUpload", {
				method: "POST",
				body: formData,
			});
			expect(res.status).toBe(200);
			const result = (await res.json()) as any;
			expect(result.statementType).toBe("broker");
			expect(result.portfolio).toBeArrayOfSize(1);
			expect(result.taggedTransactions).toBeArrayOfSize(1);
			expect(result.portfolio[0]).toBeArrayOfSize(5);
			expect(result.portfolio[0][0]).toMatchObject({
				instrumentName:
					"Dimensional Global Short-Term Investment Grade Fixed Income Fund (DSF)",
				units: 196.811,
				price: 22.17,
				marketValue: 4363.3,
				currency: "SGD",
				securityType: "managedFund",
			});

			// Uploading only looks securities up; nothing is created until the
			// user confirms the statement.
			const securitiesAfter = await db
				.select({ id: securities.id })
				.from(securities)
				.where(inArray(securities.name, fundNames));
			expect(securitiesAfter.map((s) => s.id).sort()).toEqual(
				securitiesBefore.map((s) => s.id).sort(),
			);
		});
		test("file upload: attaches an already known security", async () => {
			const [chocolateCompany] = await db
				.select()
				.from(companies)
				.where(eq(companies.name, "Chocolate Finance"));
			if (!chocolateCompany) throw new Error("Chocolate Finance not seeded");
			const fundName = "UOBAM United SGD Fund (USF)";

			// A mapper may already exist (e.g. from a confirmed statement), in
			// which case this test reuses it instead of creating data.
			const existingMapper = (
				await db
					.select()
					.from(securityToStatementMappers)
					.where(
						and(
							eq(securityToStatementMappers.companyId, chocolateCompany.id),
							eq(securityToStatementMappers.identifier, fundName),
						),
					)
			)[0];
			let createdSecurityId: number | undefined;
			let securityId = existingMapper?.securityId;
			if (!securityId) {
				const [security] = await db
					.insert(securities)
					.values({
						name: fundName,
						securityType: "managedFund",
						currency: "SGD",
					})
					.returning();
				if (!security) throw new Error("Could not insert test security");
				securityId = security.id;
				createdSecurityId = security.id;
				await db.insert(securityToStatementMappers).values({
					companyId: chocolateCompany.id,
					identifier: fundName,
					securityId,
				});
			}

			const formData = getCompleteFormData("./test-files/chocolate.pdf");
			const res = await app.request("/api/ui/fileUpload", {
				method: "POST",
				body: formData,
			});
			expect(res.status).toBe(200);
			const result = (await res.json()) as any;
			const usf = result.portfolio[0].find(
				(holding: { instrumentName: string }) =>
					holding.instrumentName === fundName,
			);
			expect(usf.securityId).toBe(securityId);

			if (createdSecurityId) {
				await db
					.delete(securityToStatementMappers)
					.where(eq(securityToStatementMappers.securityId, createdSecurityId));
				await db.delete(securities).where(eq(securities.id, createdSecurityId));
			}
		});
		test("file upload: no user id", async () => {
			const formData = new FormData();
			const testFile = Bun.file("./test-files/dbsCard.pdf");
			formData.append("file", testFile);
			const res = await app.request("/api/ui/fileUpload", {
				method: "POST",
				body: formData,
			});
			expect(res.status).toBe(400);
			const result = await res.text();
			expect(result).toInclude("expected string");
			expect(result).toInclude("userId");
		});
		test("file upload: unknown statement", async () => {
			const formData = getCompleteFormData("./test-files/sample.pdf");
			const res = await app.request("/api/ui/fileUpload", {
				method: "POST",
				body: formData,
			});
			expect(res.status).toBe(500);
			expect(await res.text()).toInclude("Unable to determine");
		});
	});
	describe("assign to", () => {
		const cardData: UserCardInsertSchema[] = [
			{
				cardLabel: "test-card-num",
				cardId: 1,
				userId: testUser.id,
			},
			{
				cardLabel: "test-card-num-2",
				cardId: 2,
				userId: testUser.id,
			},
		];

		const accountData: UserAccountsInsertSchema = {
			accountId: 1,
			accountLabel: "test-account-label-1",
			userId: testUser.id,
		};
		test("no user id given", async () => {
			const res = await app.request("/api/ui/assignTo/", {
				method: "POST",
				body: JSON.stringify({
					accountData: [accountData],
					cardData,
				}),
				...jsonHeader,
			});
			expect(res.status).toBe(400);
			expect(await res.text()).toInclude("specify a user id");
		});
		test("invalid user id given", async () => {
			const res = await app.request("/api/ui/assignTo/someRandomId", {
				method: "POST",
				body: JSON.stringify({
					accountData: [accountData],
					cardData,
				}),
				...jsonHeader,
			});
			expect(res.status).toBe(404);
			expect(await res.text()).toInclude("was not found");
		});
		test("no card or account ids given", async () => {
			const res = await app.request("/api/ui/assignTo/someId", {
				method: "POST",
				body: JSON.stringify({}),
				...jsonHeader,
			});
			expect(res.status).toBe(400);
			expect(await res.text()).toInclude("No ids to assign");
		});
		test("invalid card id given", async () => {
			const res = await app.request("/api/ui/assignTo/testUser1Id", {
				method: "POST",
				body: JSON.stringify({
					accountData: [accountData],
					cardData: [
						...cardData,
						{ cardId: 1000, cardNumber: "abcd", userId: testUser.id },
					],
				}),
				...jsonHeader,
			});
			expect(res.status).toBe(400);
			expect(await res.text()).toInclude("does not exist");
		});
		test("invalid account id given", async () => {
			const res = await app.request("/api/ui/assignTo/testUser1Id", {
				method: "POST",
				body: JSON.stringify({
					accountData: [
						{
							...accountData,
							accountId: 10000,
						},
					],
					cardData,
				}),
				...jsonHeader,
			});
			expect(res.status).toBe(400);
			expect(await res.text()).toInclude("does not exist");
		});
		test("assigns successfully", async () => {
			const res = await app.request("/api/ui/assignTo/testUser1Id", {
				method: "POST",
				body: JSON.stringify({
					accountsIds: [1, 2],
					cardData,
				}),
				...jsonHeader,
			});
			expect(res.status).toBe(200);
			expect(await res.text()).toInclude("Successfully added");
		});
	});
	describe("inventory", () => {
		test("gets all available inventory and users inventory", async () => {
			const res = await app.request(
				`/api/ui/availableInventory/${testUser.id}`,
			);
			expect(res.status).toBe(200);
			const data = (await res.json()) as any;
			expect(data).toHaveProperty("allAccounts");
			expect(data).toHaveProperty("allCards");
			expect(data).toHaveProperty("userAccounts");
			expect(data).toHaveProperty("userCards");
		});
	});
	describe("linkStatement", () => {
		const testIdentifier = "test-id";
		afterAll(async () => {
			await db
				.delete(statementOwnerships)
				.where(like(statementOwnerships.identifier, `%${testIdentifier}%`));
		});
		test("invalid payload", async () => {
			const res = await app.request("/api/ui/linkStatement", {
				method: "POST",
				body: JSON.stringify({
					identifier: "",
				}),
				...jsonHeader,
			});
			expect(res.status).toBe(400);
			expect(await res.text()).toInclude("Too small");
		});
		test("links statement for card", async () => {
			const res = await app.request("/api/ui/linkStatement", {
				method: "POST",
				body: JSON.stringify({
					identifier: `${testIdentifier}-card`,
					cardId: 1,
				}),
				...jsonHeader,
			});
			expect(res.status).toBe(200);
			const body = (await res.json()) as any;
			expect(body.data).toBeObject();
		});
		test("links statement for account", async () => {
			const res = await app.request("/api/ui/linkStatement", {
				method: "POST",
				body: JSON.stringify({
					identifier: `${testIdentifier}-account`,
					accountId: 1,
				}),
				...jsonHeader,
			});
			expect(res.status).toBe(200);
			const body = (await res.json()) as any;
			expect(body.data).toBeObject();
		});
	});
});
