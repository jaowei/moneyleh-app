import {STARTING_COMPANIES} from "./company.seed";
import {db} from "./db";
import * as schema from "./schema";
import * as authSchema from "./auth-schema"

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
        name: "Altitude",
        companyId: companyIdMap.DBS,
        cardType: "miles",
    },
    {
        name: "Live_Fresh",
        companyId: companyIdMap.DBS,
        cardType: "cashback",
    },
    {
        name: "Woman's_World",
        companyId: companyIdMap.DBS,
        cardType: "rewards",
    },
    {
        name: "Revolution",
        companyId: companyIdMap.HSBC,
        cardType: "rewards",
    },
    {
        name: "TravelOne",
        companyId: companyIdMap.HSBC,
        cardType: "rewards",
    },
    {
        name: "Journey",
        companyId: companyIdMap.Standard_Chartered,
        cardType: "miles",
    },
    {
        name: "Lady's",
        companyId: companyIdMap.UOB,
        cardType: "rewards",
    },
    {
        name: "Preferred_Platinum",
        companyId: companyIdMap.UOB,
        cardType: "rewards",
    },
    {
        name: "Krisflyer Ascend",
        companyId: companyIdMap.AMEX,
        cardType: "miles",
    },
    {
        name: "PremierMiles",
        companyId: companyIdMap.Citibank,
        cardType: "miles",
    },
    {
        name: "Rewards",
        companyId: companyIdMap.Citibank,
        cardType: "rewards",
    },
    {
        name: "Ca$hback",
        companyId: companyIdMap.Trust_Bank,
        cardType: "cashback",
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
await db.insert(authSchema.user).values({
    id: 'testUser1Id',
    name: 'testUser1',
    email: 'testUser1@test.com'
}).onConflictDoNothing()
console.log("===Seed test user: Done!")

console.log(`===Seeding complete.`);
