import {Hono} from "hono";
import {zodValidator} from "../lib/middleware/zod-validator.ts";
import z from "zod";
import {accounts, accountsInsertSchemaZ} from "../db/schema.ts";
import {findUserOrThrow} from "./route.utils.ts";
import {db} from "../db/db.ts";

const accountPostPayloadZ = accountsInsertSchemaZ.extend({
    companyId: z.coerce.number(),
    name: z.string().min(1),
})

export const accountRoute = new Hono()
    .post('/:userId', zodValidator('json', accountPostPayloadZ), async (c) => {
        const {userId} = c.req.param()
        await findUserOrThrow(userId)
        const accountPayload = c.req.valid('json')
        const created = await db.insert(accounts).values(accountPayload).returning()
        return c.json(created[0])
    })
