import {Hono} from "hono";
import {tagInsertSchemaZ, tags as tagsDb, type TagUpdateSchema, tagUpdateSchemaZ} from "../db/schema.ts";
import z from "zod";
import {db} from "../db/db.ts";
import {eq} from "drizzle-orm";
import {HTTPException} from "hono/http-exception";
import {zodValidator} from "../lib/middleware/zod-validator.ts";

const postTagPayloadZ = z.object({
    tags: z.array(tagInsertSchemaZ).min(1)
})

const tagPutPayloadZ = z.object({
    tags: z.array(tagUpdateSchemaZ.extend({
        id: z.number(),
        description: z.string().min(1)
    })).min(1)
})

export const tagRoute = new Hono().post("/", zodValidator('json'
    , postTagPayloadZ), async (c) => {
    const {tags} = c.req.valid('json')

    const queryRes = await db.insert(tagsDb).values(tags).onConflictDoNothing().returning()

    c.status(201)
    return c.json({
        created: queryRes
    })
}).get('/:tagId', async (c) => {
    const {tagId} = c.req.param()

    const queryRes = await db.select().from(tagsDb).where(eq(tagsDb.id, parseInt(tagId)))
    if (!queryRes.length) {
        throw new HTTPException(404, {
            message: `Tag ${tagId} not found!`
        })
    }
    return c.json(queryRes[0])
}).get('/', async (c) => {
    const queryRes = await db.select().from(tagsDb)
    if (!queryRes.length) {
        throw new HTTPException(404, {
            message: `No tags!`
        })
    }
    return c.json({
        data: queryRes
    })
}).put('/', zodValidator('json', tagPutPayloadZ), async (c) => {
    const {tags} = c.req.valid('json')
    const failedUpdates: TagUpdateSchema[] = []
    const updatedTags = []
    for (const t of tags) {
        const updateRes = await db.update(tagsDb).set({
            description: t.description
        }).where(eq(tagsDb.id, t.id)).returning()
        if (!updateRes.length) {
            failedUpdates.push(t)
        } else {
            updatedTags.push(updateRes[0])
        }
    }
    return c.json({
        updated: updatedTags,
        failed: failedUpdates
    })
})
