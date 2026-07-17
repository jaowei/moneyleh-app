import { auth } from "../lib/auth.ts";
import { testUser } from "../lib/test.utils.ts";
import * as authSchema from "./auth-schema";
import { STARTING_COMPANIES } from "./company.seed";
import { db } from "./db";
import * as schema from "./schema";

console.log("===Seed companies: Start!");
await db
	.insert(schema.companies)
	.values([...STARTING_COMPANIES])
	.onConflictDoNothing();
console.log("===Seed companies: Done!");

const companyIds = await db
	.select({
		id: schema.companies.id,
		name: schema.companies.name,
	})
	.from(schema.companies);

const companyIdMap = companyIds.reduce(
	(prev, curr) => {
		prev[curr.name] = curr.id;
		return prev;
	},
	{} as Record<string, number>,
);

console.log("===Seed cards: Start!");
export const seedDataCards: schema.CardsInsertSchema[] = [
	{
		name: "altitude",
		companyId: companyIdMap.DBS,
		cardType: "miles",
		cardNetwork: "visa signature",
	},
	{
		name: "live fresh",
		companyId: companyIdMap.DBS,
		cardType: "cashback",
		cardNetwork: "visa signature",
	},
	{
		name: "woman's",
		companyId: companyIdMap.DBS,
		cardType: "rewards",
		cardNetwork: "world mastercard",
	},
	{
		name: "revolution",
		companyId: companyIdMap.HSBC,
		cardType: "rewards",
		cardNetwork: "visa signature",
	},
	{
		name: "travelone",
		companyId: companyIdMap.HSBC,
		cardType: "rewards",
		cardNetwork: "visa signature",
	},
	{
		name: "journey",
		companyId: companyIdMap.Standard_Chartered,
		cardType: "miles",
		cardNetwork: "visa signature",
	},
	{
		name: "lady's",
		companyId: companyIdMap.UOB,
		cardType: "rewards",
		cardNetwork: "world mastercard",
	},
	{
		name: "preferred platinum",
		companyId: companyIdMap.UOB,
		cardType: "rewards",
		cardNetwork: "visa signature",
	},
	{
		name: "krisflyer ascend",
		companyId: companyIdMap.AMEX,
		cardType: "miles",
		cardNetwork: "amex",
	},
	{
		name: "premiermiles",
		companyId: companyIdMap.Citibank,
		cardType: "miles",
		cardNetwork: "world mastercard",
	},
	{
		name: "rewards",
		companyId: companyIdMap.Citibank,
		cardType: "rewards",
		cardNetwork: "world mastercard",
	},
	{
		name: "ca$hback",
		companyId: companyIdMap.Trust_Bank,
		cardType: "cashback",
		cardNetwork: "visa signature",
	},
];
const cardsInserted = await db
	.insert(schema.cards)
	.values(seedDataCards)
	.returning()
	.onConflictDoNothing();
console.log("===Seed cards: Done!");
const cardIdMap = cardsInserted.reduce(
	(prev, curr) => {
		prev[curr.name] = curr.id;
		return prev;
	},
	{} as Record<string, number>,
);

console.log("===Seed accounts: Start!");
export const seedDataAccounts: schema.AccountsInsertSchema[] = [
	{
		name: "multiplier",
		companyId: companyIdMap.DBS,
		accountType: "cash",
	},
	{
		name: "my account",
		companyId: companyIdMap.DBS,
		accountType: "cash",
	},
	{
		name: "supplementary retirement scheme account",
		companyId: companyIdMap.DBS,
		accountType: "cash",
	},
	{
		name: "esavings",
		companyId: companyIdMap.DBS,
		accountType: "cash",
	},
	{
		name: "one account",
		companyId: companyIdMap.UOB,
		accountType: "cash",
	},
	{
		name: "stash",
		companyId: companyIdMap.UOB,
		accountType: "cash",
	},
	{
		name: "ordinary account",
		companyId: companyIdMap.CPF,
		accountType: "CPF",
	},
	{
		name: "medisave account",
		companyId: companyIdMap.CPF,
		accountType: "CPF",
	},
	{
		name: "special account",
		companyId: companyIdMap.CPF,
		accountType: "CPF",
	},
	{
		name: "investment account",
		companyId: companyIdMap.CPF,
		accountType: "CPF",
	},
	{
		name: "cash",
		companyId: companyIdMap["Interactive Brokers"],
		accountType: "brokerage",
	},
	{
		name: "cash",
		companyId: companyIdMap["Moo Moo"],
		accountType: "brokerage",
	},
	{
		name: "cash",
		companyId: companyIdMap["Tiger Brokers"],
		accountType: "brokerage",
	},
	{
		name: "cash",
		companyId: companyIdMap.IFast,
		accountType: "brokerage",
	},
	{
		name: "chocolate managed account",
		companyId: companyIdMap["Chocolate Finance"],
		accountType: "cash",
	},
];
const accountsInserted = await db
	.insert(schema.accounts)
	.values(seedDataAccounts)
	.returning()
	.onConflictDoNothing();
const accountIdMap = accountsInserted.reduce(
	(prev, curr) => {
		prev[curr.name] = curr.id;
		return prev;
	},
	{} as Record<string, number>,
);
console.log("===Seed accounts: Done!");

console.log("===Seed statement owners: Start!");
const seedStatementOwnerships: schema.StatementOwnershipsInsertSchema[] = [
	{ cardId: cardIdMap["altitude"], identifier: "DBS ALTITUDE VISA SIGNATURE" },
	{ cardId: cardIdMap["woman's"], identifier: "DBS WOMAN'S WORLD MASTERCARD" },
	{ cardId: cardIdMap["lady's"], identifier: "LADY'S CARD" },
	{
		cardId: cardIdMap["preferred platinum"],
		identifier: "PREFERRED PLATINUM VISA",
	},
	{
		cardId: cardIdMap["preferred platinum"],
		identifier: "PREFERRED VISA",
	},
	{
		cardId: cardIdMap["premiermiles"],
		identifier: "CITI PREMIERMILES WORLD MASTER",
	},
	{ cardId: cardIdMap["rewards"], identifier: "CITI REWARDS WORLD MASTERCARD" },
	{ accountId: accountIdMap["my account"], identifier: "My Account" },
	{
		accountId: accountIdMap["supplementary retirement scheme account"],
		identifier: "Supplementary Retirement Scheme Account",
	},
	{ accountId: accountIdMap["one account"], identifier: "One Account" },
	{ accountId: accountIdMap["stash"], identifier: "UOB Stash Account" },
	{
		accountId: accountIdMap["ordinary account"],
		identifier: "ordinaryAccount",
	},
	{
		accountId: accountIdMap["medisave account"],
		identifier: "medisaveAccount",
	},
	{ accountId: accountIdMap["special account"], identifier: "specialAccount" },
	{
		accountId: accountIdMap["investment account"],
		identifier: "investmentAccount",
	},
	{
		accountId: accountIdMap["chocolate managed account"],
		identifier: "chocolateManagedAccount",
	},
];
await db
	.insert(schema.statementOwnerships)
	.values(seedStatementOwnerships)
	.onConflictDoNothing();
console.log("===Seed statement owners: Done!");

console.log("===Seed test user: Start!");
// add test user for UI
try {
	await auth.api.createUser({
		body: {
			name: testUser.name,
			email: testUser.email,
			password: testUser.password,
			role: "admin",
		},
	});
} catch (e) {
	console.log(e);
}
// add test user for backend tests
await db.insert(authSchema.user).values([testUser]).onConflictDoNothing();
console.log("===Seed test user: Done!");

console.log(`===Seeding complete.`);
