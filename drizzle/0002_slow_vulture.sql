PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transaction_shares` (
	`transaction_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`share` real NOT NULL,
	`updated_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`deleted_at` text,
	PRIMARY KEY(`transaction_id`, `user_id`),
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_transaction_shares`("transaction_id", "user_id", "share", "updated_at", "created_at", "deleted_at") SELECT "transaction_id", "user_id", "share", "updated_at", "created_at", "deleted_at" FROM `transaction_shares`;--> statement-breakpoint
DROP TABLE `transaction_shares`;--> statement-breakpoint
ALTER TABLE `__new_transaction_shares` RENAME TO `transaction_shares`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `session` ADD `impersonated_by` text;--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
ALTER TABLE `user` ADD `role` text;--> statement-breakpoint
ALTER TABLE `user` ADD `banned` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_expires` integer;--> statement-breakpoint
CREATE INDEX `auth_account_userId_idx` ON `auth_account` (`user_id`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);