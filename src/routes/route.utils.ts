import {db} from "../db/db.ts";
import {user} from "../db/auth-schema.ts";
import {eq} from "drizzle-orm";
import {HTTPException} from "hono/http-exception";

export const findUserOrThrow = async (userId: string) => {
    const targetUser = await db.select().from(user).where(eq(user.id, userId))

    if (!targetUser.length) {
        throw new HTTPException(404, {
            message: `user id: ${userId} was not found!`
        })
    }

    return targetUser
}