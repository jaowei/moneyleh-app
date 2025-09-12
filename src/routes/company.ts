import { Hono } from "hono";
import { validator } from "hono/validator";
import { company, companyInsertSchema } from "../db/schema";
import { HTTPException } from "hono/http-exception";
import { db } from "../db/db";
import z from "zod";
import { eq } from "drizzle-orm";

export const companyRoute = new Hono();

companyRoute.post(
  "/",
  validator("json", (value) => {
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
    c.status(201);
    return c.json(created[0]);
  }
);

companyRoute.get("/", async (c) => {
  const companies = await db.select().from(company);
  return c.json({
    data: companies,
  });
});

companyRoute.get("/:id", async (c) => {
  const targetId = parseInt(c.req.param('id'))
  const targetCompany = await db.select().from(company).where(eq(company.id, targetId));
  return c.json({
    data: targetCompany,
  });
});