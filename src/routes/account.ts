import { Hono } from "hono";
import z from "zod";
import { db } from "../db/db.ts";
import { accounts, accountsInsertSchemaZ } from "../db/schema.ts";
import { zodValidator } from "../lib/middleware/zod-validator.ts";
import { findUserOrThrow, removeUserAssignments } from "./route.utils.ts";

const accountPostPayloadZ = accountsInsertSchemaZ.extend({
	companyId: z.coerce.number(),
	name: z.string().min(1),
});

export const accountRoute = new Hono()
	.post("/:userId", zodValidator("json", accountPostPayloadZ), async (c) => {
		const { userId } = c.req.param();
		await findUserOrThrow(userId);
		const accountPayload = c.req.valid("json");
		const created = await db
			.insert(accounts)
			.values(accountPayload)
			.returning();
		return c.json(created[0]);
	})
	.delete("/:userId/:accountId", async (c) => {
		const { userId, accountId } = c.req.param();
		const accountIdNum = parseInt(accountId, 10);
		removeUserAssignments({ type: "account", id: accountIdNum, userId });
		return c.text("Account removed");
	});
