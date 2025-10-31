import {sql} from "drizzle-orm";
import {sqliteTable, text, integer, real, primaryKey} from "drizzle-orm/sqlite-core";
import {createInsertSchema, createUpdateSchema} from "drizzle-zod";
import z from "zod";
import {user} from "./auth-schema.ts";

const timestamps = {
    updated_at: text(),
    created_at: text()
        .notNull()
        .default(sql`(CURRENT_TIMESTAMP)`),
    deleted_at: text(),
};

export const companies = sqliteTable("companies", {
    id: integer().primaryKey({autoIncrement: true}),
    name: text().notNull().unique(),
    ...timestamps,
});
export const companiesInsertSchema = createInsertSchema(companies, {
    name: z.string().min(1),
});
export const companiesUpdateSchema = createUpdateSchema(companies, {
    name: z.string().min(1),
});

export const accounts = sqliteTable("accounts", {
    id: integer().primaryKey({autoIncrement: true}),
    name: text().notNull(),
    companyId: integer("company_id").references(() => companies.id),
    accountType: text("account_type", {
        enum: ["brokerage", "cash", "fixedDeposit", "CPF", "insurance", "wallet"],
    }),
    ...timestamps,
});

export const cards = sqliteTable("cards", {
    id: integer().primaryKey({autoIncrement: true}),
    name: text().notNull(),
    companyId: integer("company_id").references(() => companies.id),
    cardType: text("card_type", {
        enum: ["miles", "rewards", "cashback"],
    }),
    cardNetwork: text("card_network", {
        enum: ["visa signature", "world mastercard", "amex"]
    }),
    ...timestamps,
});

export const securities = sqliteTable("securities", {
    id: integer().primaryKey({autoIncrement: true}),
    name: text().notNull(),
    ticker: text(),
    securityType: text("security_type", {
        enum: ["stock", "bond", "etf", "managedFund"],
    }),
    brokerId: integer("broker_id").references(() => companies.id),
});

export const insurancePolicies = sqliteTable("insurance_policies", {
    id: integer().primaryKey({autoIncrement: true}),
    name: text().notNull(),
    policyType: text("policy_type", {
        enum: [
            "wholeLife",
            "termLife",
            "criticalIllness",
            "disability",
            "medical",
            "personalAccident",
        ],
    }),
    companyId: integer("company_id").references(() => companies.id),
});

export const tags = sqliteTable("tags", {
    id: integer().primaryKey({autoIncrement: true}),
    description: text().notNull().unique(),
    ...timestamps,
});

export const transactions = sqliteTable("transactions", {
    id: integer().primaryKey({autoIncrement: true}),
    transactionDate: text("transaction_date"),
    description: text(),
    currency: text(),
    amount: real(),
    accountId: integer("account_id").references(() => accounts.id),
    cardId: integer("card_id").references(() => cards.id),
    userId: text("user_id").references(() => user.id),
    ...timestamps,
});
export const transactionsInsertSchemaZ = createInsertSchema(transactions)
export type TransactionsInsertSchema = z.infer<typeof transactionsInsertSchemaZ>

export const transactionTags = sqliteTable("transaction_tags", {
    transactionId: integer("transaction_id").references(() => transactions.id),
    tagId: integer("tag_id").references(() => tags.id),
    ...timestamps,
}, (table) => [primaryKey({columns: [table.transactionId, table.tagId]})])

export const userCompanies = sqliteTable("user_companies", {
    companyId: integer("company_id").references(() => companies.id),
    userId: text("user_id").references(() => user.id),
    ...timestamps
}, (table) => [primaryKey({columns: [table.companyId, table.userId]})])

export const userAccounts = sqliteTable("user_accounts", {
    accountId: integer("account_id").references(() => accounts.id),
    userId: text("user_id").references(() => user.id),
    ...timestamps
}, (table) => [primaryKey({columns: [table.accountId, table.userId]})])

export const userCards = sqliteTable("user_cards", {
    cardNumber: text("card_number").primaryKey().unique(),
    cardId: integer("card_id").references(() => cards.id),
    userId: text("user_id").references(() => user.id),
    ...timestamps
})

export const userInsurancePolicies = sqliteTable("user_insurance_policies", {
    insurancePolicyId: integer("insurance_policy_id").references(() => insurancePolicies.id),
    userId: text("user_id").references(() => user.id),
    ...timestamps
}, (table) => [primaryKey({columns: [table.insurancePolicyId, table.userId]})])

export const userSecurities = sqliteTable("user_securities", {
    securityId: integer("security_id").references(() => securities.id),
    userId: text("user_id").references(() => user.id),
    ...timestamps
}, (table) => [primaryKey({columns: [table.securityId, table.userId]})])
