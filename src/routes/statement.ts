import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/db";
import { holdings, statements } from "../db/schema";

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
		db.transaction((tx) => {
			// Holdings are snapshots of this statement, so they go with it.
			tx.delete(holdings).where(eq(holdings.statementId, statementIdNum)).all();
			tx.delete(statements).where(eq(statements.id, statementIdNum)).all();
		});
		return c.text(`Deleted statement with id ${statementId}`);
	});
