import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { user } from "../db/auth-schema.ts";
import { db } from "../db/db.ts";
import { statementOwnerships } from "../db/schema.ts";

export const findUserOrThrow = async (userId: string) => {
	const targetUser = await db.select().from(user).where(eq(user.id, userId));

	if (!targetUser.length) {
		throw new HTTPException(404, {
			message: `user id: ${userId} was not found!`,
		});
	}

	return targetUser;
};

export const getStatementOwnerByIdentifier = async (target: string) => {
	return await db
		.select()
		.from(statementOwnerships)
		.where(
			sql`lower(${statementOwnerships.identifier}) = ${target.toLowerCase()}`,
		);
};
