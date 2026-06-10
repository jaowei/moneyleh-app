import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/db";
import { statements } from "../db/schema";

export const statementRoute = new Hono()
	.get("/", async (c) => {
		const data = await db.select().from(statements);
		return c.json({
			data,
		});
	})
	.delete("/:statementId", async (c) => {
		const { statementId } = c.req.param();
		const statementIdNum = parseInt(statementId, 10);
		await db.delete(statements).where(eq(statements.id, statementIdNum));
		return c.text(`Deleted statement with id ${statementId}`);
	});
