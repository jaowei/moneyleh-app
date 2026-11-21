CREATE TABLE `holdings` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` integer NOT NULL,
	`security_id` integer NOT NULL,
	`statement_id` integer NOT NULL,
	`as_of_date` text NOT NULL,
	`units` real NOT NULL,
	`price` real NOT NULL,
	`market_value` real NOT NULL,
	`currency` text NOT NULL,
	`cost_basis` real,
	`unrealised_gain` real,
	`extra` text,
	`updated_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`security_id`) REFERENCES `securities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`statement_id`) REFERENCES `statements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `holdings_account_id_security_id_as_of_date_unique` ON `holdings` (`account_id`,`security_id`,`as_of_date`);--> statement-breakpoint
CREATE TABLE `security_to_statement_mappers` (
	`id` integer PRIMARY KEY NOT NULL,
	`company_id` integer NOT NULL,
	`identifier` text NOT NULL,
	`security_id` integer NOT NULL,
	`updated_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`security_id`) REFERENCES `securities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `security_to_statement_mappers_company_id_identifier_unique` ON `security_to_statement_mappers` (`company_id`,`identifier`);--> statement-breakpoint
DROP TABLE `user_securities`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_securities` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`isin` text,
	`symbol` text,
	`security_type` text NOT NULL,
	`currency` text,
	`updated_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
INSERT INTO `__new_securities`("id", "name", "isin", "symbol", "security_type", "currency", "updated_at", "created_at", "deleted_at") SELECT "id", "name", "isin", "symbol", "security_type", "currency", "updated_at", "created_at", "deleted_at" FROM `securities`;--> statement-breakpoint
DROP TABLE `securities`;--> statement-breakpoint
ALTER TABLE `__new_securities` RENAME TO `securities`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `securities_isin_unique` ON `securities` (`isin`);