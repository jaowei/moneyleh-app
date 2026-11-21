import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	jest,
	test,
} from "bun:test";
import { and, eq, inArray } from "drizzle-orm";
import { user } from "../db/auth-schema.ts";
import { db } from "../db/db.ts";
import {
	accounts,
	companies,
	holdings,
	securities,
	statementOwnerships,
	statements,
} from "../db/schema.ts";
import app from "../index.ts";
import { auth } from "../lib/auth.ts";
import { getTestUserDetails, testUser } from "../lib/test.utils.ts";

const getSessionSpy = jest.spyOn(auth.api, "getSession");

const mockSession = (userId: string) => {
	getSessionSpy.mockResolvedValue({
		user: { id: userId },
		session: { id: "test-session", userId },
	} as never);
};

const request = (userId: string) =>
	app.request(`/api/portfolio/${userId}`, { method: "GET" });

describe("/api/portfolio", () => {
	db.run("PRAGMA busy_timeout = 5000;");
	const accountOneName = `portfolio-read-account-${Date.now()}-1`;
	const accountTwoName = `portfolio-read-account-${Date.now()}-2`;
	const securityOneName = `portfolio-read-security-${Date.now()}-1`;
	const securityTwoName = `portfolio-read-security-${Date.now()}-2`;
	const securityThreeName = `portfolio-read-security-${Date.now()}-3`;
	const ownedAccountIds: number[] = [];
	const ownedSecurityIds: number[] = [];
	const ownedStatementIds: number[] = [];
	let companyId = 0;
	let ownershipId = 0;

	beforeAll(async () => {
		await db.insert(user).values(getTestUserDetails("4")).onConflictDoNothing();
		const [company] = await db
			.select()
			.from(companies)
			.where(eq(companies.name, "Chocolate Finance"));
		if (!company) throw new Error("Chocolate Finance not seeded");
		companyId = company.id;
		const [ownership] = await db
			.select()
			.from(statementOwnerships)
			.where(eq(statementOwnerships.identifier, "chocolateManagedAccount"));
		if (!ownership) throw new Error("Chocolate ownership not seeded");
		ownershipId = ownership.id;
	});

	afterEach(() => {
		getSessionSpy.mockReset();
	});
	afterAll(async () => {
		getSessionSpy.mockRestore();
		if (ownedAccountIds.length) {
			await db
				.delete(holdings)
				.where(inArray(holdings.accountId, ownedAccountIds));
		}
		if (ownedStatementIds.length) {
			await db
				.delete(statements)
				.where(inArray(statements.id, ownedStatementIds));
		}
		if (ownedSecurityIds.length) {
			await db
				.delete(securities)
				.where(inArray(securities.id, ownedSecurityIds));
		}
		if (ownedAccountIds.length) {
			await db.delete(accounts).where(inArray(accounts.id, ownedAccountIds));
		}
	});

	const createAccount = async (name: string) => {
		const [account] = await db
			.insert(accounts)
			.values({ name, companyId })
			.returning();
		if (!account) throw new Error(`Could not create account ${name}`);
		ownedAccountIds.push(account.id);
		return account;
	};

	const createSecurity = async (name: string) => {
		const [security] = await db
			.insert(securities)
			.values({ name, securityType: "managedFund", currency: "SGD" })
			.returning();
		if (!security) throw new Error(`Could not create security ${name}`);
		ownedSecurityIds.push(security.id);
		return security;
	};

	const createStatement = async (statementDate: string) => {
		const [statement] = await db
			.insert(statements)
			.values({
				statementDate,
				userId: testUser.id,
				statementOwnershipId: ownershipId,
			})
			.returning();
		if (!statement) throw new Error("Could not create statement");
		ownedStatementIds.push(statement.id);
		return statement;
	};

	const createHolding = async ({
		account,
		security,
		statement,
		asOfDate,
		units,
		price,
		marketValue,
		unrealisedGain,
		extra,
	}: {
		account: { id: number };
		security: { id: number };
		statement: { id: number };
		asOfDate: string;
		units: number;
		price: number;
		marketValue: number;
		unrealisedGain?: number;
		extra?: string;
	}) => {
		const [holding] = await db
			.insert(holdings)
			.values({
				userId: testUser.id,
				accountId: account.id,
				securityId: security.id,
				statementId: statement.id,
				asOfDate,
				units,
				price,
				marketValue,
				currency: "SGD",
				unrealisedGain: unrealisedGain ?? null,
				extra: extra ?? null,
			})
			.returning();
		if (!holding) throw new Error("Could not create holding");
		return holding;
	};

	test("rejects a request without a session", async () => {
		getSessionSpy.mockResolvedValue(null as never);
		const res = await request(testUser.id);
		expect(res.status).toBe(401);
		expect(await res.text()).toInclude("signed in");
	});

	test("rejects another user's portfolio", async () => {
		mockSession(testUser.id);
		const res = await request("testUser4Id");
		expect(res.status).toBe(403);
		expect(await res.text()).toInclude("your own data");
	});

	test("returns an empty portfolio for a user without holdings", async () => {
		mockSession("testUser4Id");
		const res = await request("testUser4Id");
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		expect(body.asOfDate).toBeNull();
		expect(body.holdings).toBeArrayOfSize(0);
		expect(body.totalValueByCurrency).toEqual({});
		expect(body.byType).toBeArrayOfSize(0);
		expect(body.byAccount).toBeArrayOfSize(0);
	});

	test("returns the latest snapshot per account with totals", async () => {
		mockSession(testUser.id);
		const accountOne = await createAccount(accountOneName);
		const securityOne = await createSecurity(securityOneName);
		const securityTwo = await createSecurity(securityTwoName);
		const oldStatement = await createStatement("2025-01-31T15:59:59.999Z");
		const newStatement = await createStatement("2025-02-28T15:59:59.999Z");

		// Same account, two dates, different instruments: only the newest
		// snapshot is part of the current portfolio.
		await createHolding({
			account: accountOne,
			security: securityOne,
			statement: oldStatement,
			asOfDate: "2025-01-31T15:59:59.999Z",
			units: 10,
			price: 1,
			marketValue: 40.5,
		});
		await createHolding({
			account: accountOne,
			security: securityTwo,
			statement: newStatement,
			asOfDate: "2025-02-28T15:59:59.999Z",
			units: 100.25,
			price: 2,
			marketValue: 200.5,
			unrealisedGain: 5.25,
			extra: JSON.stringify({ unrealisedGainPct: 2.5, allocationPct: 100 }),
		});

		const res = await request(testUser.id);
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;

		expect(body.asOfDate).toBe("2025-02-28T15:59:59.999Z");
		const accountHoldings = body.holdings.filter(
			(h: { accountId: number }) => h.accountId === accountOne.id,
		);
		expect(accountHoldings).toHaveLength(1);
		expect(accountHoldings[0]).toMatchObject({
			securityId: securityTwo.id,
			securityName: securityTwoName,
			securityType: "managedFund",
			units: 100.25,
			price: 2,
			marketValue: 200.5,
			currency: "SGD",
			unrealisedGain: 5.25,
			asOfDate: "2025-02-28T15:59:59.999Z",
		});
		expect(accountHoldings[0].extra).toEqual({
			unrealisedGainPct: 2.5,
			allocationPct: 100,
		});
		expect(accountHoldings[0]).toHaveProperty("accountName", accountOneName);
		expect(accountHoldings[0]).toHaveProperty(
			"companyName",
			"Chocolate Finance",
		);

		const accountSummary = body.byAccount.find(
			(entry: { accountId: number }) => entry.accountId === accountOne.id,
		);
		expect(accountSummary).toMatchObject({
			accountName: accountOneName,
			companyName: "Chocolate Finance",
			currency: "SGD",
			marketValue: 200.5,
			asOfDate: "2025-02-28T15:59:59.999Z",
		});
		expect(body.byType).toContainEqual({
			securityType: "managedFund",
			currency: "SGD",
			marketValue: 200.5,
		});
		expect(body.totalValueByCurrency.SGD).toBeGreaterThanOrEqual(200.5);
	});

	test("reports each account's own latest date", async () => {
		mockSession(testUser.id);
		const accountTwo = await createAccount(accountTwoName);
		const securityThree = await createSecurity(securityThreeName);
		const statement = await createStatement("2025-03-31T15:59:59.999Z");
		await createHolding({
			account: accountTwo,
			security: securityThree,
			statement,
			asOfDate: "2025-03-31T15:59:59.999Z",
			units: 5,
			price: 10,
			marketValue: 50,
		});

		const res = await request(testUser.id);
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		const accountSummaries = body.byAccount.filter(
			(entry: { accountId: number }) => entry.accountId === accountTwo.id,
		);
		expect(accountSummaries).toHaveLength(1);
		expect(accountSummaries[0].asOfDate).toBe("2025-03-31T15:59:59.999Z");
		// The global date is the newest across accounts.
		expect(body.asOfDate).toBe("2025-03-31T15:59:59.999Z");
	});
});
