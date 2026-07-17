CREATE TABLE `transaction_shares` (
	`transaction_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`share` real NOT NULL,
	`updated_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`deleted_at` text,
	PRIMARY KEY(`transaction_id`, `user_id`),
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
