import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import z from "zod";

const timestamps = {
  updated_at: text(),
  created_at: text()
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  deleted_at: text(),
};

export const company = sqliteTable("company", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
  ...timestamps,
});
export const companyInsertSchema = createInsertSchema(company, {
  name: z.string().min(1),
});
export const companyUpdateSchema = createUpdateSchema(company, {
  name: z.string().min(1),
});

export const accounts = sqliteTable("accounts", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  companyId: integer("company_id").references(() => company.id),
  accountType: text("account_type", {
    enum: ["brokerage", "cash", "fixedDeposit", "CPF", "insurance", "wallet"],
  }),
  ...timestamps,
});

export const cards = sqliteTable("cards", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  companyId: integer("company_id").references(() => company.id),
  cardType: text("card_type", {
    enum: ["miles", "rewards", "cashback"],
  }),
  ...timestamps,
});

export const securities = sqliteTable("securities", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  ticker: text(),
  securityType: text("security_type", {
    enum: ["stock", "bond", "etf", "managedFund"],
  }),
  brokerId: integer("broker_id").references(() => company.id),
});

export const insurancePolicies = sqliteTable("insurance_policies", {
  id: integer().primaryKey({ autoIncrement: true }),
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
  companyId: integer("company_id").references(() => company.id),
});

export const users = sqliteTable("users", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
  ...timestamps,
});

export const tags = sqliteTable("tags", {
  id: integer().primaryKey({ autoIncrement: true }),
  description: text().notNull().unique(),
  ...timestamps,
});

export const transactions = sqliteTable("transactions", {
  id: integer().primaryKey({ autoIncrement: true }),
  transactionDate: text("transaction_date"),
  description: text(),
  currency: text(),
  amount: real(),
  accountId: integer("account_id").references(() => accounts.id),
  cardId: integer("card_id").references(() => cards.id),
  userId: integer("user_id").references(() => users.id),
  ...timestamps,
});

export const transactionTags = sqliteTable("transaction_tags", {
  transactionId: integer("transaction_id").references(() => transactions.id),
  tagId: integer("tag_id").references(() => tags.id),
  ...timestamps,
});
