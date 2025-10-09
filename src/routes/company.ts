import {Hono} from "hono";
import {
    companies,
    companiesInsertSchema,
    companiesUpdateSchema,
} from "../db/schema";
import {db} from "../db/db";
import {eq} from "drizzle-orm";
import {zodValidator} from "../lib/middleware/zod-validator";
import {HTTPException} from "hono/http-exception";

export const companyRoute = new Hono();

companyRoute.post("/", zodValidator(companiesInsertSchema), async (c) => {
    const data = c.req.valid("json");
    const created = await db.insert(companies).values(data).returning();
    c.status(201);
    return c.json(created[0]);
});

companyRoute.get("/", async (c) => {
    const allCompanies = await db.select().from(companies);
    return c.json({
        data: allCompanies,
    });
});

companyRoute.get("/:id", async (c) => {
    const targetId = parseInt(c.req.param("id"));
    const targetCompany = await db
        .select()
        .from(companies)
        .where(eq(companies.id, targetId));
    return c.json({
        data: targetCompany,
    });
});

companyRoute.put("/:id", zodValidator(companiesUpdateSchema), async (c) => {
    const data = c.req.valid("json");
    const targetId = parseInt(c.req.param("id"));
    const updatedCompanyId = await db
        .update(companies)
        .set({
            ...data,
            updated_at: new Date().toISOString(),
        })
        .where(eq(companies.id, targetId))
        .returning({updatedId: companies.id, updatedAt: companies.updated_at});
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
