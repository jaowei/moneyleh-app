import {STARTING_COMPANIES} from "./company.seed";
import {db} from "./db";
import * as schema from "./schema";
import * as authSchema from "./auth-schema"
import {testTag, testUser, testUserAccount} from "../lib/test.utils.ts";

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
await db.insert(schema.cards).values([
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
]).onConflictDoNothing();
console.log("===Seed cards: Done!")


console.log("===Seed accounts: Start!")
await db
    .insert(schema.accounts)
    .values([
        {
            name: 'Multiplier',
            companyId: companyIdMap.DBS,
            accountType: 'cash'
        },
        {
            name: 'MyAccount',
            companyId: companyIdMap.DBS,
            accountType: 'cash'
        },
        {
            name: 'ESavings',
            companyId: companyIdMap.DBS,
            accountType: 'cash'
        },
        {
            name: 'One',
            companyId: companyIdMap.UOB,
            accountType: 'cash'
        },
        {
            name: 'Ordinary_Account',
            companyId: companyIdMap.CPF,
            accountType: 'CPF'
        },
        {
            name: 'Medisave_Account',
            companyId: companyIdMap.CPF,
            accountType: 'CPF'
        },
        {
            name: 'Special_Account',
            companyId: companyIdMap.CPF,
            accountType: 'CPF'
        },
        {
            name: 'Cash',
            companyId: companyIdMap.Interactive_Brokers,
            accountType: 'brokerage'
        },
        {
            name: 'Cash',
            companyId: companyIdMap.Moo_Moo,
            accountType: 'brokerage'
        },
        {
            name: 'Cash',
            companyId: companyIdMap.Tiger_Brokers,
            accountType: 'brokerage'
        },
        {
            name: 'Cash',
            companyId: companyIdMap.IFast,
            accountType: 'brokerage'
        },
    ])
    .onConflictDoNothing();
console.log("===Seed accounts: Done!")

console.log("===Seed test user: Start!")
await db.insert(authSchema.user).values(testUser).onConflictDoNothing()
console.log("===Seed test user: Done!")

console.log("===Seed test user account: Start!")
await db.insert(authSchema.auth_account).values(testUserAccount).onConflictDoNothing()
console.log("===Seed test user account: Done!")

console.log("===Seed test tag: Start!")
await db.insert(schema.tags).values({
    description: testTag.description,
}).onConflictDoNothing()
console.log("===Seed test tag: Done!")

console.log(`===Seeding complete.`);
