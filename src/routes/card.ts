import { Hono } from "hono";
import z from "zod";
import { db } from "../db/db.ts";
import { cards, cardsInsertSchemaZ } from "../db/schema.ts";
import { zodValidator } from "../lib/middleware/zod-validator.ts";
import { findUserOrThrow } from "./route.utils.ts";

const cardPostPayloadZ = cardsInsertSchemaZ.extend({
	companyId: z.coerce.number(),
	name: z.string().min(1),
});

export const cardRoute = new Hono().post(
	"/:userId",
	zodValidator("json", cardPostPayloadZ),
	async (c) => {
		const { userId } = c.req.param();
		await findUserOrThrow(userId);
		const cardPayload = c.req.valid("json");
		const created = await db.insert(cards).values(cardPayload).returning();
		return c.json(created[0]);
	},
);
