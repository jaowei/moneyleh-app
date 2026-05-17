import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { db } from "../db/db.ts";
import {
	type CardsSelectSchema,
	cards,
	cardsInsertSchemaZ,
	statementOwnerships,
} from "../db/schema.ts";
import { zodValidator } from "../lib/middleware/zod-validator.ts";
import { findUserOrThrow } from "./route.utils.ts";

const cardPostPayloadZ = cardsInsertSchemaZ.extend({
	companyId: z.coerce.number(),
	name: z.string().min(1),
	statementIdentifier: z.string().optional(),
});

export const cardRoute = new Hono().post(
	"/:userId",
	zodValidator("json", cardPostPayloadZ),
	async (c) => {
		const { userId } = c.req.param();
		await findUserOrThrow(userId);
		const { statementIdentifier, ...rest } = c.req.valid("json");
		let created: CardsSelectSchema | undefined;
		db.transaction((tx) => {
			const createdRes = tx.insert(cards).values(rest).returning().all();
			if (!createdRes[0]) {
				throw new HTTPException(400, { message: "Error creating card" });
			}
			created = createdRes[0];

			if (statementIdentifier) {
				tx.insert(statementOwnerships)
					.values({
						identifier: statementIdentifier,
						cardId: createdRes[0].id,
					})
					.returning()
					.onConflictDoNothing()
					.all();
			}
		});
		return c.json(created);
	},
);
