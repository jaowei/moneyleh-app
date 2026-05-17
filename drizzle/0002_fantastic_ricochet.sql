PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_statement_ownerships` (
	`id` integer PRIMARY KEY NOT NULL,
	`identifier` text,
	`account_id` integer,
	`card_id` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_statement_ownerships`("id", "identifier", "account_id", "card_id") SELECT row_number() OVER (ORDER BY "statement_id") as "id", "identifier", "account_id", "card_id" FROM `statement_ownerships`;--> statement-breakpoint
DROP TABLE `statement_ownerships`;--> statement-breakpoint
ALTER TABLE `__new_statement_ownerships` RENAME TO `statement_ownerships`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `statements` ADD `statement_ownership_id` integer REFERENCES statement_ownerships(id);