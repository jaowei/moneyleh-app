import { sql } from "drizzle-orm";
import {
	integer,
	primaryKey,
	real,
	sqliteTable,
	text,
	unique,
} from "drizzle-orm/sqlite-core";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import z from "zod";
import { user } from "./auth-schema.ts";

const timestamps = {
	updated_at: text(),
	created_at: text().notNull().default(sql`(CURRENT_TIMESTAMP)`),
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

export const accountTypes: [string, ...string[]] = [
	"brokerage",
	"cash",
	"fixedDeposit",
	"CPF",
	"insurance",
	"wallet",
	"joint",
];
export const accounts = sqliteTable(
	"accounts",
	{
		id: integer().primaryKey(),
		name: text().notNull(),
		companyId: integer("company_id").references(() => companies.id),
		accountType: text("account_type", {
			enum: accountTypes,
		}),
		...timestamps,
	},
	(table) => [unique().on(table.name, table.companyId)],
);
export const accountsInsertSchemaZ = createInsertSchema(accounts);
export const accountsSelectSchemaZ = createSelectSchema(accounts);
export type AccountsInsertSchema = z.infer<typeof accountsInsertSchemaZ>;
export type accountsSelectSchema = z.infer<typeof accountsSelectSchemaZ>;

export const cardTypes: [string, ...string[]] = [
	"miles",
	"rewards",
	"cashback",
];
export const cardNetworks: [string, ...string[]] = [
	"visa signature",
	"world mastercard",
	"amex",
];
export const cards = sqliteTable(
	"cards",
	{
		id: integer().primaryKey(),
		name: text().notNull(),
		companyId: integer("company_id").references(() => companies.id),
		cardType: text("card_type", {
			enum: cardTypes,
		}),
		cardNetwork: text("card_network", {
			enum: cardNetworks,
		}),
		...timestamps,
	},
	(table) => [unique().on(table.name, table.companyId)],
);
export const cardsInsertSchemaZ = createInsertSchema(cards);
const cardsSelectSchemaZ = createSelectSchema(cards);
export type CardsInsertSchema = z.infer<typeof cardsInsertSchemaZ>;
export type CardsSelectSchema = z.infer<typeof cardsSelectSchemaZ>;

export const securityTypes = ["stock", "bond", "etf", "managedFund"] as const;
export const securityTypeZ = z.enum(securityTypes);
export type SecurityType = z.infer<typeof securityTypeZ>;

export const securities = sqliteTable("securities", {
	id: integer().primaryKey(),
	name: text().notNull(),
	// Nullable: not every broker prints an ISIN, and SQLite allows multiple
	// NULL values in a unique column.
	isin: text().unique(),
	symbol: text(),
	securityType: text("security_type", { enum: securityTypes }).notNull(),
	currency: text(),
	...timestamps,
});
export const securitiesInsertSchemaZ = createInsertSchema(securities);
export const securitiesSelectSchemaZ = createSelectSchema(securities);
export type SecuritiesInsertSchema = z.infer<typeof securitiesInsertSchemaZ>;
export type SecuritiesSelectSchema = z.infer<typeof securitiesSelectSchemaZ>;

// Maps the instrument identifier printed on a statement (an ISIN, a ticker or
// a fund name) to a security. Scoped per company because two brokers may print
// the same identifier for different instruments.
export const securityToStatementMappers = sqliteTable(
	"security_to_statement_mappers",
	{
		id: integer().primaryKey(),
		companyId: integer("company_id")
			.references(() => companies.id)
			.notNull(),
		identifier: text().notNull(),
		securityId: integer("security_id")
			.references(() => securities.id)
			.notNull(),
		...timestamps,
	},
	(table) => [unique().on(table.companyId, table.identifier)],
);
export const securityToStatementMappersInsertSchemaZ = createInsertSchema(
	securityToStatementMappers,
);
export const securityToStatementMappersSelectSchemaZ = createSelectSchema(
	securityToStatementMappers,
);
export type SecurityToStatementMappersInsertSchema = z.infer<
	typeof securityToStatementMappersInsertSchemaZ
>;
export type SecurityToStatementMappersSelectSchema = z.infer<
	typeof securityToStatementMappersSelectSchemaZ
>;

// A snapshot of an instrument held in an account on a statement date. Snapshots
// keep history instead of overwriting a single quantity, and the unique key
// stops the same statement date being recorded twice for an instrument.
export const holdings = sqliteTable(
	"holdings",
	{
		id: integer().primaryKey(),
		userId: text("user_id")
			.references(() => user.id)
			.notNull(),
		accountId: integer("account_id")
			.references(() => accounts.id)
			.notNull(),
		securityId: integer("security_id")
			.references(() => securities.id)
			.notNull(),
		statementId: integer("statement_id")
			.references(() => statements.id)
			.notNull(),
		asOfDate: text("as_of_date").notNull(),
		units: real().notNull(),
		price: real().notNull(),
		marketValue: real("market_value").notNull(),
		currency: text().notNull(),
		costBasis: real("cost_basis"),
		unrealisedGain: real("unrealised_gain"),
		// JSON blob for broker specific fields without a dedicated column.
		extra: text(),
		...timestamps,
	},
	(table) => [unique().on(table.accountId, table.securityId, table.asOfDate)],
);
export const holdingsInsertSchemaZ = createInsertSchema(holdings, {
	asOfDate: z.iso.datetime(),
});
export const holdingsSelectSchemaZ = createSelectSchema(holdings);
export type HoldingsInsertSchema = z.infer<typeof holdingsInsertSchemaZ>;
export type HoldingsSelectSchema = z.infer<typeof holdingsSelectSchemaZ>;

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
export const tagSelectSchemaZ = createSelectSchema(tags);
export type TagSelectSchema = z.infer<typeof tagSelectSchemaZ>;
export const tagInsertSchemaZ = createInsertSchema(tags, {
	description: z.string().min(1),
});
export type TagInsertSchema = z.infer<typeof tagInsertSchemaZ>;
export const tagUpdateSchemaZ = createUpdateSchema(tags);
export type TagUpdateSchema = z.infer<typeof tagUpdateSchemaZ>;

export const transactions = sqliteTable("transactions", {
	id: integer().primaryKey(),
	transactionDate: text("transaction_date").notNull(),
	description: text().notNull(),
	currency: text().notNull(),
	amount: real().notNull(),
	accountId: integer("account_id").references(() => accounts.id),
	cardId: integer("card_id").references(() => cards.id),
	userId: text("user_id")
		.references(() => user.id)
		.notNull(),
	...timestamps,
});
export const transactionsInsertSchemaZ = createInsertSchema(transactions);
export type TransactionsInsertSchema = z.infer<
	typeof transactionsInsertSchemaZ
>;
export const transactionsUpdateSchemaZ = createUpdateSchema(transactions);
export type TransactionsUpdateSchema = z.infer<
	typeof transactionsUpdateSchemaZ
>;
export const transactionsSelectSchemaZ = createSelectSchema(transactions);
export type TransactionsSelectSchema = z.infer<
	typeof transactionsSelectSchemaZ
>;

export const statements = sqliteTable("statements", {
	id: integer().primaryKey(),
	statementDate: text("statement_date").notNull(),
	userId: text("user_id")
		.references(() => user.id)
		.notNull(),
	statementOwnershipId: integer("statement_ownership_id")
		.references(() => statementOwnerships.id)
		.notNull(),
	...timestamps,
});

export const statementOwnerships = sqliteTable("statement_ownerships", {
	id: integer().primaryKey(),
	identifier: text().unique().notNull(),
	accountId: integer("account_id").references(() => accounts.id),
	cardId: integer("card_id").references(() => cards.id),
	...timestamps,
});
export const statementOwnershipsInsertSchemaZ =
	createInsertSchema(statementOwnerships);
export const statementOwnershipsSelectSchemaZ =
	createSelectSchema(statementOwnerships);
export type StatementOwnershipsInsertSchema = z.infer<
	typeof statementOwnershipsInsertSchemaZ
>;
export type StatementOwnershipsSelectSchema = z.infer<
	typeof statementOwnershipsSelectSchemaZ
>;

export const transactionStatements = sqliteTable(
	"transaction_statements",
	{
		transactionId: integer("transaction_id")
			.notNull()
			.references(() => transactions.id),
		statementId: integer("statement_id")
			.notNull()
			.references(() => statements.id),
		...timestamps,
	},
	(table) => [
		primaryKey({ columns: [table.transactionId, table.statementId] }),
	],
);

export const transactionTags = sqliteTable(
	"transaction_tags",
	{
		transactionId: integer("transaction_id")
			.notNull()
			.references(() => transactions.id),
		tagId: integer("tag_id")
			.notNull()
			.references(() => tags.id),
		...timestamps,
	},
	(table) => [primaryKey({ columns: [table.transactionId, table.tagId] })],
);
export const transactionTagsInsertSchemaZ = createInsertSchema(transactionTags);
export type TransactionTagsInsertSchema = z.infer<
	typeof transactionTagsInsertSchemaZ
>;

export const transactionShares = sqliteTable(
	"transaction_shares",
	{
		transactionId: integer("transaction_id")
			.notNull()
			.references(() => transactions.id),
		userId: text("user_id")
			.notNull()
			.references(() => user.id),
		share: real().notNull(),
		...timestamps,
	},
	(table) => [primaryKey({ columns: [table.transactionId, table.userId] })],
);
export const transactionSharesInsertSchemaZ = createInsertSchema(
	transactionShares,
	{
		share: z.number().min(1).max(100),
	},
);
export type TransactionSharesInsertSchema = z.infer<
	typeof transactionSharesInsertSchemaZ
>;
const transactionSharesSelectSchemaZ = createSelectSchema(transactionShares);
export type transactionSharesSelectSchema = z.infer<
	typeof transactionSharesSelectSchemaZ
>;

export const userCompanies = sqliteTable(
	"user_companies",
	{
		companyId: integer("company_id").references(() => companies.id),
		userId: text("user_id").references(() => user.id),
		...timestamps,
	},
	(table) => [primaryKey({ columns: [table.companyId, table.userId] })],
);

export const userAccounts = sqliteTable(
	"user_accounts",
	{
		accountId: integer("account_id")
			.references(() => accounts.id)
			.notNull(),
		userId: text("user_id")
			.references(() => user.id)
			.notNull(),
		accountLabel: text("account_label"),
		...timestamps,
	},
	(table) => [primaryKey({ columns: [table.accountId, table.userId] })],
);
export const userAccountInsertSchemaZ = createInsertSchema(userAccounts);
export type UserAccountsInsertSchema = z.infer<typeof userAccountInsertSchemaZ>;

export const userCards = sqliteTable(
	"user_cards",
	{
		cardId: integer("card_id")
			.references(() => cards.id)
			.notNull(),
		userId: text("user_id")
			.references(() => user.id)
			.notNull(),
		cardLabel: text("card_label"),
		...timestamps,
	},
	(table) => [primaryKey({ columns: [table.cardId, table.userId] })],
);
export const userCardInsertSchemaZ = createInsertSchema(userCards);
export type UserCardInsertSchema = z.infer<typeof userCardInsertSchemaZ>;

export const userInsurancePolicies = sqliteTable(
	"user_insurance_policies",
	{
		insurancePolicyId: integer("insurance_policy_id").references(
			() => insurancePolicies.id,
		),
		userId: text("user_id").references(() => user.id),
		...timestamps,
	},
	(table) => [primaryKey({ columns: [table.insurancePolicyId, table.userId] })],
);
