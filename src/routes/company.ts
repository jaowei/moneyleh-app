import { Hono } from "hono";
import { validator } from "hono/validator";
import { company, companyInsertSchema } from "../db/schema";
import { HTTPException } from "hono/http-exception";
import { db } from "../db/db";
import z from "zod";

export const companyRoute = new Hono();

companyRoute.post(
  "/",
  validator("json", (value, c) => {
    const parsed = companyInsertSchema.safeParse(value);
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: z.prettifyError(parsed.error)
      });
    }
    return parsed.data;
  }),
  async (c) => {
    const data = c.req.valid("json");
    const created = await db.insert(company).values(data).returning();
    c.status(201)
    return c.json(created[0])
  }
);
