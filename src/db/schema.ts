import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, primaryKey, unique } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import z from "zod";
import { user } from "./auth-schema.ts";

const timestamps = {
    updated_at: text(),
    created_at: text()
        .notNull()
        .default(sql`(CURRENT_TIMESTAMP)`),
    deleted_at: text(),
};

export const companies = sqliteTable("companies", {
    id: integer().primaryKey(),
    name: text().notNull().unique(),
    ...timestamps,
});
export const companiesInsertSchema = createInsertSchema(companies, {
    name: z.string().min(1),
});
export const companiesUpdateSchema = createUpdateSchema(companies, {
    name: z.string().min(1),
});

export const accountTypes: [string, ...string[]] = ["brokerage", "cash", "fixedDeposit", "CPF", "insurance", "wallet", "joint"]
export const accounts = sqliteTable("accounts", {
    id: integer().primaryKey(),
    name: text().notNull(),
    companyId: integer("company_id").references(() => companies.id),
    accountType: text("account_type", {
        enum: accountTypes,
    }),
    ...timestamps,
}, (table) => [unique().on(table.name, table.companyId)]);
export const accountsInsertSchemaZ = createInsertSchema(accounts)
export const accountsSelectSchemaZ = createSelectSchema(accounts)
export type AccountsInsertSchema = z.infer<typeof accountsInsertSchemaZ>
export type accountsSelectSchema = z.infer<typeof accountsSelectSchemaZ>

export const cardTypes: [string, ...string[]] = ["miles", "rewards", "cashback"]
export const cardNetworks: [string, ...string[]] = ["visa signature", "world mastercard", "amex"]
export const cards = sqliteTable("cards", {
    id: integer().primaryKey(),
    name: text().notNull(),
    companyId: integer("company_id").references(() => companies.id),
    cardType: text("card_type", {
        enum: cardTypes,
    }),
    cardNetwork: text("card_network", {
        enum: cardNetworks
    }),
    ...timestamps,
}, (table) => [unique().on(table.name, table.companyId)]);
export const cardsInsertSchemaZ = createInsertSchema(cards)
const cardsSelectSchemaZ = createSelectSchema(cards)
export type CardsInsertSchema = z.infer<typeof cardsInsertSchemaZ>
export type CardsSelectSchema = z.infer<typeof cardsSelectSchemaZ>

export const securities = sqliteTable("securities", {
    id: integer().primaryKey(),
    name: text().notNull(),
    ticker: text(),
    securityType: text("security_type", {
        enum: ["stock", "bond", "etf", "managedFund"],
    }),
    brokerId: integer("broker_id").references(() => companies.id),
});

export const insurancePolicies = sqliteTable("insurance_policies", {
    id: integer().primaryKey(),
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
    id: integer().primaryKey(),
    description: text().notNull().unique(),
    ...timestamps,
});
export const tagSelectSchemaZ = createSelectSchema(tags)
export type TagSelectSchema = z.infer<typeof tagSelectSchemaZ>
export const tagInsertSchemaZ = createInsertSchema(tags, {
    description: z.string().min(1)
})
export type TagInsertSchema = z.infer<typeof tagInsertSchemaZ>
export const tagUpdateSchemaZ = createUpdateSchema(tags)
export type TagUpdateSchema = z.infer<typeof tagUpdateSchemaZ>

export const transactions = sqliteTable("transactions", {
    id: integer().primaryKey(),
    transactionDate: text("transaction_date").notNull(),
    description: text().notNull(),
    currency: text().notNull(),
    amount: real().notNull(),
    accountId: integer("account_id").references(() => accounts.id),
    cardId: integer("card_id").references(() => cards.id),
    userId: text("user_id").references(() => user.id).notNull(),
    ...timestamps,
});
export const transactionsInsertSchemaZ = createInsertSchema(transactions)
export type TransactionsInsertSchema = z.infer<typeof transactionsInsertSchemaZ>
export const transactionsUpdateSchemaZ = createUpdateSchema(transactions)
export type TransactionsUpdateSchema = z.infer<typeof transactionsUpdateSchemaZ>
export const transactionsSelectSchemaZ = createSelectSchema(transactions)
export type TransactionsSelectSchema = z.infer<typeof transactionsSelectSchemaZ>

export const statements = sqliteTable("statements", {
    id: integer().primaryKey(),
    statementDate: text("statement_date").notNull(),
    userId: text("user_id").references(() => user.id).notNull(),
    ...timestamps
})

export const statementOwnerships = sqliteTable("statement_ownerships", {
    statementId: integer("statement_id").notNull().references(() => statements.id, { onDelete: "cascade" }),
    accountId: integer("account_id").references(() => accounts.id),
    cardId: integer("card_id").references(() => cards.id),
})

export const transactionStatements = sqliteTable("transaction_statements", {
    transactionId: integer("transaction_id").notNull().references(() => transactions.id),
    statementId: integer("statement_id").notNull().references(() => statements.id),
    ...timestamps,
}, (table) => [primaryKey({ columns: [table.transactionId, table.statementId] })])

export const transactionTags = sqliteTable("transaction_tags", {
    transactionId: integer("transaction_id").notNull().references(() => transactions.id),
    tagId: integer("tag_id").notNull().references(() => tags.id),
    ...timestamps,
}, (table) => [primaryKey({ columns: [table.transactionId, table.tagId] })])
export const transactionTagsInsertSchemaZ = createInsertSchema(transactionTags)
export type TransactionTagsInsertSchema = z.infer<typeof transactionTagsInsertSchemaZ>

export const userCompanies = sqliteTable("user_companies", {
    companyId: integer("company_id").references(() => companies.id),
    userId: text("user_id").references(() => user.id),
    ...timestamps
}, (table) => [primaryKey({ columns: [table.companyId, table.userId] })])

export const userAccounts = sqliteTable("user_accounts", {
    accountId: integer("account_id").references(() => accounts.id).notNull(),
    userId: text("user_id").references(() => user.id).notNull(),
    accountLabel: text("account_label"),
    ...timestamps
}, (table) => [primaryKey({ columns: [table.accountId, table.userId] })])
export const userAccountInsertSchemaZ = createInsertSchema(userAccounts)
export type UserAccountsInsertSchema = z.infer<typeof userAccountInsertSchemaZ>

export const userCards = sqliteTable("user_cards", {
    cardId: integer("card_id").references(() => cards.id).notNull(),
    userId: text("user_id").references(() => user.id).notNull(),
    cardLabel: text("card_label"),
    ...timestamps
}, (table) => [primaryKey({ columns: [table.cardId, table.userId] })])
export const userCardInsertSchemaZ = createInsertSchema(userCards)
export type UserCardInsertSchema = z.infer<typeof userCardInsertSchemaZ>

export const userInsurancePolicies = sqliteTable("user_insurance_policies", {
    insurancePolicyId: integer("insurance_policy_id").references(() => insurancePolicies.id),
    userId: text("user_id").references(() => user.id),
    ...timestamps
}, (table) => [primaryKey({ columns: [table.insurancePolicyId, table.userId] })])

export const userSecurities = sqliteTable("user_securities", {
    securityId: integer("security_id").references(() => securities.id),
    userId: text("user_id").references(() => user.id),
    ...timestamps
}, (table) => [primaryKey({ columns: [table.securityId, table.userId] })])
