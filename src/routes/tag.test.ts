import { afterAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import app from "..";
import { db } from "../db/db.ts";
import {
	type TagInsertSchema,
	type TagSelectSchema,
	tags,
} from "../db/schema.ts";
import { jsonHeader } from "../lib/test.utils.ts";

describe("/api/tag", () => {
	db.run("PRAGMA busy_timeout = 5000;");
	describe("create", () => {
		const tagPayload: TagInsertSchema = {
			description: `test-tag-${new Date()}`,
		};
		afterAll(async () => {
			await db.delete(tags).where(eq(tags.description, tagPayload.description));
		});
		test("Fails to create: invalid payload", async () => {
			const res = await app.request("/api/tag", {
				method: "POST",
				...jsonHeader,
				body: JSON.stringify({
					tags: [{ description: "" }],
				}),
			});
			expect(res.status).toBe(400);
			expect(await res.text()).toInclude("expected string");
		});
		test("Fails to create: no payload", async () => {
			const res = await app.request("/api/tag", {
				method: "POST",
				...jsonHeader,
				body: JSON.stringify({
					tags: [],
				}),
			});
			expect(res.status).toBe(400);
			expect(await res.text()).toInclude("expected array");
		});
		test("create: twice", async () => {
			const res = await app.request("/api/tag", {
				method: "POST",
				...jsonHeader,
				body: JSON.stringify({
					tags: [tagPayload, tagPayload],
				}),
			});
			expect(res.status).toBe(201);
			const resData = (await res.json()) as { created: any[] };
			expect(resData.created).toHaveLength(1);

			const res2 = await app.request("/api/tag", {
				method: "POST",
				...jsonHeader,
				body: JSON.stringify({
					tags: [tagPayload],
				}),
			});
			expect(res2.status).toBe(201);
			const resData2 = (await res2.json()) as { created: any[] };
			expect(resData2.created).toHaveLength(0);
		});
	});

	describe("get", () => {
		const tagDesc = "tag-api-test-get";
		afterAll(async () => {
			await db.delete(tags).where(eq(tags.description, tagDesc));
		});
		test("get invalid id", async () => {
			const res = await app.request("/api/tag/invalidId", {
				method: "GET",
			});
			expect(res.status).toBe(404);
		});
		test("get by id", async () => {
			const createdRes = await db
				.insert(tags)
				.values({ description: tagDesc })
				.returning();
			if (!createdRes[0]) throw new Error("creation failed");
			const res = await app.request(`/api/tag/${createdRes[0].id}`, {
				method: "GET",
			});
			expect(res.status).toBe(200);
			const resData = (await res.json()) as TagSelectSchema;
			expect(resData.id).toBe(createdRes[0].id);
		});
		test("get all", async () => {
			const res = await app.request("/api/tag", {
				method: "GET",
			});
			expect(res.status).toBe(200);
			const resData = (await res.json()) as { data: TagSelectSchema[] };
			expect(resData.data.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("put", () => {
		const tagDesc = "tag-api-test-update";
		afterAll(async () => {
			await db.delete(tags).where(eq(tags.description, tagDesc));
		});
		test("Fails to update: no payload", async () => {
			const res = await app.request("/api/tag", {
				method: "PUT",
				...jsonHeader,
				body: JSON.stringify({
					tags: [],
				}),
			});
			expect(res.status).toBe(400);
		});
		test("updates", async () => {
			const createdRes = await db
				.insert(tags)
				.values({ description: tagDesc })
				.returning();
			if (!createdRes[0]) throw new Error("creation failed");
			const res = await app.request("/api/tag", {
				method: "PUT",
				...jsonHeader,
				body: JSON.stringify({
					tags: [
						{
							id: createdRes[0].id,
							description: "test-tag-updated!",
						},
					],
				}),
			});
			expect(res.status).toBe(200);
			const resData = (await res.json()) as { updated: any[]; failed: any[] };
			expect(resData.failed).toHaveLength(0);
			expect(resData.updated).toHaveLength(1);
			await db.delete(tags).where(eq(tags.id, createdRes[0].id));
		});
		test("Fails to update: invalid tag payload", async () => {
			const res = await app.request("/api/tag", {
				method: "PUT",
				...jsonHeader,
				body: JSON.stringify({
					tags: [
						{
							description: "",
						},
					],
				}),
			});
			expect(res.status).toBe(400);
			const resText = await res.text();
			expect(resText).toInclude("expected number");
			expect(resText).toInclude("expected string");
		});
	});
});
