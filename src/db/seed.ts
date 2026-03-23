import { STARTING_COMPANIES } from "./company.seed";
import { db } from "./db";
import * as schema from "./schema";
import * as authSchema from "./auth-schema"
import { testTag, testUser } from "../lib/test.utils.ts";
import { auth } from "../lib/auth.ts";

console.log("===Seed companies: Start!")
await db
    .insert(schema.companies)
    .values(STARTING_COMPANIES)
    .onConflictDoNothing();
console.log("===Seed companies: Done!")

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
    {} as Record<string, number>
);

console.log("===Seed cards: Start!")
export const seedDataCards: schema.CardsInsertSchema[] = [
    {
        name: "altitude",
        companyId: companyIdMap.DBS,
        cardType: "miles",
        cardNetwork: "visa signature"
    },
    {
        name: "live fresh",
        companyId: companyIdMap.DBS,
        cardType: "cashback",
        cardNetwork: "visa signature"
    },
    {
        name: "woman's",
        companyId: companyIdMap.DBS,
        cardType: "rewards",
        cardNetwork: "world mastercard"
    },
    {
        name: "revolution",
        companyId: companyIdMap.HSBC,
        cardType: "rewards",
        cardNetwork: "visa signature"
    },
    {
        name: "travelone",
        companyId: companyIdMap.HSBC,
        cardType: "rewards",
        cardNetwork: "visa signature"
    },
    {
        name: "journey",
        companyId: companyIdMap.Standard_Chartered,
        cardType: "miles",
        cardNetwork: "visa signature"
    },
    {
        name: "lady's",
        companyId: companyIdMap.UOB,
        cardType: "rewards",
        cardNetwork: "world mastercard"
    },
    {
        name: "preferred platinum",
        companyId: companyIdMap.UOB,
        cardType: "rewards",
        cardNetwork: "visa signature"
    },
    {
        name: "krisflyer ascend",
        companyId: companyIdMap.AMEX,
        cardType: "miles",
        cardNetwork: "amex"
    },
    {
        name: "premier miles",
        companyId: companyIdMap.Citibank,
        cardType: "miles",
        cardNetwork: "world mastercard"
    },
    {
        name: "rewards",
        companyId: companyIdMap.Citibank,
        cardType: "rewards",
        cardNetwork: "world mastercard"
    },
    {
        name: "ca$hback",
        companyId: companyIdMap.Trust_Bank,
        cardType: "cashback",
        cardNetwork: "visa signature"
    },
]
await db.insert(schema.cards).values(seedDataCards).onConflictDoNothing();
console.log("===Seed cards: Done!")


console.log("===Seed accounts: Start!")
export const seedDataAccounts: schema.AccountsInsertSchema[] = [
    {
        name: 'multiplier',
        companyId: companyIdMap.DBS,
        accountType: 'cash'
    },
    {
        name: 'my_account',
        companyId: companyIdMap.DBS,
        accountType: 'cash'
    },
    {
        name: 'supplementary_retirement_scheme_account',
        companyId: companyIdMap.DBS,
        accountType: 'cash'
    },
    {
        name: 'esavings',
        companyId: companyIdMap.DBS,
        accountType: 'cash'
    },
    {
        name: 'one',
        companyId: companyIdMap.UOB,
        accountType: 'cash'
    },
    {
        name: 'stash',
        companyId: companyIdMap.UOB,
        accountType: 'cash'
    },
    {
        name: 'ordinary_account',
        companyId: companyIdMap.CPF,
        accountType: 'CPF'
    },
    {
        name: 'medisave_account',
        companyId: companyIdMap.CPF,
        accountType: 'CPF'
    },
    {
        name: 'special_account',
        companyId: companyIdMap.CPF,
        accountType: 'CPF'
    },
    {
        name: 'investment_account',
        companyId: companyIdMap.CPF,
        accountType: 'CPF'
    },
    {
        name: 'cash',
        companyId: companyIdMap.Interactive_Brokers,
        accountType: 'brokerage'
    },
    {
        name: 'cash',
        companyId: companyIdMap.Moo_Moo,
        accountType: 'brokerage'
    },
    {
        name: 'cash',
        companyId: companyIdMap.Tiger_Brokers,
        accountType: 'brokerage'
    },
    {
        name: 'cash',
        companyId: companyIdMap.IFast,
        accountType: 'brokerage'
    },
]
await db
    .insert(schema.accounts)
    .values(seedDataAccounts)
    .onConflictDoNothing();
console.log("===Seed accounts: Done!")

console.log("===Seed test user: Start!")
// add test user for UI
try {
    await auth.api.signUpEmail({
        body: testUser
    })
} catch (e) {
    console.log(e)
}
// add test user for backend tests
await db.insert(authSchema.user).values(testUser).onConflictDoNothing()
console.log("===Seed test user: Done!")

console.log("===Seed test tag: Start!")
await db.insert(schema.tags).values({
    description: testTag.description,
}).onConflictDoNothing()
console.log("===Seed test tag: Done!")

console.log(`===Seeding complete.`);
