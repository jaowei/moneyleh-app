CREATE UNIQUE INDEX `statement_ownerships_identifier_unique` ON `statement_ownerships` (`identifier`);--> statement-breakpoint
CREATE TABLE `__new_statements` (
	`id` integer PRIMARY KEY NOT NULL,
	`statement_date` text NOT NULL,
	`user_id` text NOT NULL,
	`statement_ownership_id` integer NOT NULL,
	`updated_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`statement_ownership_id`) REFERENCES `statement_ownerships`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_statements`("id", "statement_date", "user_id", "statement_ownership_id", "updated_at", "created_at", "deleted_at") SELECT "id", "statement_date", "user_id", "statement_ownership_id", "updated_at", "created_at", "deleted_at" FROM `statements`;--> statement-breakpoint
DROP TABLE `statements`;--> statement-breakpoint
ALTER TABLE `__new_statements` RENAME TO `statements`;