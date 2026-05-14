import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import app from "..";
import { db } from "../db/db.ts";
import { companies } from "../db/schema.ts";
import { jsonHeader } from "../lib/test.utils.ts";

describe("/api/company", () => {
	describe("create", () => {
		const companyName = `test-company-${Date.now()}`;
		afterAll(async () => {
			await db.delete(companies).where(eq(companies.name, companyName));
		});
		test("Fails to create: already exists", async () => {
			const res = await app.request("/api/company", {
				method: "POST",
				body: JSON.stringify({
					name: "DBS",
				}),
				...jsonHeader,
			});
			expect(res.status).toBe(409);
		});
		test("Fails to create: provided only empty string", async () => {
			const res = await app.request("/api/company", {
				method: "POST",
				body: JSON.stringify({
					name: "",
				}),
				...jsonHeader,
			});
			expect(res.status).toBe(400);
			const errorText = await res.text();
			expect(errorText).toInclude("Too small:");
			expect(errorText).toInclude("at name");
		});
		test("Creates", async () => {
			const res = await app.request("/api/company", {
				method: "POST",
				body: JSON.stringify({
					name: companyName,
				}),
				...jsonHeader,
			});
			expect(res.status).toBe(201);
			expect(await res.json()).toHaveProperty("name");
		});
	});

	describe("read", () => {
		test("Get all companies", async () => {
			const res = await app.request("/api/company", {
				method: "GET",
			});
			expect(res.status).toBe(200);
			const resBody: any = await res.json();
			expect(resBody.data).toBeArray();
			expect(resBody.data.length).toBeGreaterThan(1);
		});
		test("Get a company", async () => {
			const res = await app.request("/api/company/1", {
				method: "GET",
			});
			expect(res.status).toBe(200);
			const resBody: any = await res.json();
			expect(resBody.data).toBeArray();
			expect(resBody.data.length).toBe(1);
		});
		test("Fails to get: does not exist", async () => {
			const res = await app.request("/api/company/IDK", {
				method: "GET",
			});
			expect(res.status).toBe(200);
			const resBody: any = await res.json();
			expect(resBody.data).toBeArray();
			expect(resBody.data.length).toBe(0);
		});
	});

	describe("update", () => {
		let companyId = 1000;
		const companyName = "test-company";
		beforeAll(async () => {
			const res = await db
				.insert(companies)
				.values({ name: companyName })
				.returning();
			if (res[0]) {
				companyId = res[0].id;
			}
		});
		afterAll(async () => {
			await db.delete(companies).where(eq(companies.name, companyName));
		});
		test("Fails to upate: invalid payload", async () => {
			const res = await app.request("/api/company/1", {
				method: "PUT",
				body: JSON.stringify({
					name: "",
				}),
				...jsonHeader,
			});
			expect(res.status).toBe(400);
			const errorText = await res.text();
			expect(errorText).toInclude("Too small:");
			expect(errorText).toInclude("at name");
		});
		test("Fails to upate: empty path param", async () => {
			const res = await app.request("/api/company", {
				method: "PUT",
				body: JSON.stringify({
					name: "helloNewName",
				}),
				...jsonHeader,
			});
			expect(res.status).toBe(404);
			const errorText = await res.text();
			expect(errorText).toInclude("Not found");
		});
		test("Fails to upate: invalid company id", async () => {
			const res = await app.request("/api/company/invalidId", {
				method: "PUT",
				body: JSON.stringify({
					name: "helloNewName",
				}),
				...jsonHeader,
			});
			expect(res.status).toBe(404);
			const errorText = await res.text();
			expect(errorText).toInclude("Could not find company id");
		});
		test("Updates: company id", async () => {
			const res = await app.request(`/api/company/${companyId}`, {
				method: "PUT",
				body: JSON.stringify({
					name: companyName,
				}),
				...jsonHeader,
			});
			expect(res.status).toBe(201);
			const payload = await res.json();
			expect(payload).toHaveProperty("updatedId");
			expect(payload).toHaveProperty("updatedAt");
		});
	});
});
