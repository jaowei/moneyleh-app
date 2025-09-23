import { Hono } from "hono";
import {
  company,
  companyInsertSchema,
  companyUpdateSchema,
} from "../db/schema";
import { db } from "../db/db";
import { eq } from "drizzle-orm";
import { zodValidator } from "../lib/middleware/zod-validator";
import { HTTPException } from "hono/http-exception";

export const companyRoute = new Hono();

companyRoute.post("/", zodValidator(companyInsertSchema), async (c) => {
  const data = c.req.valid("json");
  const created = await db.insert(company).values(data).returning();
  c.status(201);
  return c.json(created[0]);
});

companyRoute.get("/", async (c) => {
  const companies = await db.select().from(company);
  return c.json({
    data: companies,
  });
});

companyRoute.get("/:id", async (c) => {
  const targetId = parseInt(c.req.param("id"));
  const targetCompany = await db
    .select()
    .from(company)
    .where(eq(company.id, targetId));
  return c.json({
    data: targetCompany,
  });
});

companyRoute.put("/:id", zodValidator(companyUpdateSchema), async (c) => {
  const data = c.req.valid("json");
  const targetId = parseInt(c.req.param("id"));
  const updatedCompanyId = await db
    .update(company)
    .set({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .where(eq(company.id, targetId))
    .returning({ updatedId: company.id, updatedAt: company.updated_at });
  if (!updatedCompanyId.length) {
    throw new HTTPException(404, {
      message: `Could not find company id "${targetId}"`,
    });
  }
  c.status(201);
  return c.json(updatedCompanyId[0]);
});

companyRoute.put("/*", async (c) => {
  c.status(404);
  return c.text("Not found");
});
