-- Custom SQL migration file, put your code below! --
INSERT INTO statement_ownerships(id, identifier, card_id) VALUES (NULL, "DBS ALTITUDE VISA SIGNATURE", (SELECT id FROM cards WHERE name = "altitude"));--> statement-breakpoint
INSERT INTO statement_ownerships(id, identifier, card_id) VALUES (NULL, "DBS WOMAN'S WORLD MASTERCARD", (SELECT id FROM cards WHERE name = "woman's"));--> statement-breakpoint
INSERT INTO statement_ownerships(id, identifier, card_id) VALUES (NULL, "LADY'S CARD", (SELECT id FROM cards WHERE name = "lady's"));--> statement-breakpoint
INSERT INTO statement_ownerships(id, identifier, card_id) VALUES (NULL, "PREFERRED PLATINUM VISA", (SELECT id FROM cards WHERE name = "preferred platinum"));--> statement-breakpoint
INSERT INTO statement_ownerships(id, identifier, card_id) VALUES (NULL, "PREFERRED VISA", (SELECT id FROM cards WHERE name = "preferred platinum"));--> statement-breakpoint
INSERT INTO statement_ownerships(id, identifier, card_id) VALUES (NULL, "CITI PREMIERMILES WORLD MASTER", (SELECT id FROM cards WHERE name = "premiermiles"));--> statement-breakpoint
INSERT INTO statement_ownerships(id, identifier, card_id) VALUES (NULL, "CITI REWARDS WORLD MASTERCARD", (SELECT id FROM cards WHERE name = "rewards"));--> statement-breakpoint
INSERT INTO statement_ownerships(id, identifier, account_id) VALUES (NULL, "My Account", (SELECT id FROM accounts WHERE name = "my account"));--> statement-breakpoint
INSERT INTO statement_ownerships(id, identifier, account_id) VALUES (NULL, "Supplementary Retirement Scheme Account", (SELECT id FROM accounts WHERE name = "supplementary retirement scheme account"));--> statement-breakpoint
INSERT INTO statement_ownerships(id, identifier, account_id) VALUES (NULL, "One Account", (SELECT id FROM accounts WHERE name = "one"));--> statement-breakpoint
INSERT INTO statement_ownerships(id, identifier, account_id) VALUES (NULL, "UOB Stash Account", (SELECT id FROM accounts WHERE name = "stash"));--> statement-breakpoint
INSERT INTO statement_ownerships(id, identifier, account_id) VALUES (NULL, "ordinaryAccount", (SELECT id FROM accounts WHERE name = "ordinary account"));--> statement-breakpoint
INSERT INTO statement_ownerships(id, identifier, account_id) VALUES (NULL, "medisaveAccount", (SELECT id FROM accounts WHERE name = "medisave account"));--> statement-breakpoint
INSERT INTO statement_ownerships(id, identifier, account_id) VALUES (NULL, "specialAccount", (SELECT id FROM accounts WHERE name = "special account"));--> statement-breakpoint
INSERT INTO statement_ownerships(id, identifier, account_id) VALUES (NULL, "investmentAccount", (SELECT id FROM accounts WHERE name = "investment account"));--> statement-breakpoint
INSERT INTO statement_ownerships(id, identifier, account_id) VALUES (NULL, "chocolateManagedAccount", (SELECT id FROM accounts WHERE name = "chocolate managed account"));