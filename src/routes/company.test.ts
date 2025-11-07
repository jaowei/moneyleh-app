import {describe, expect, test} from "bun:test";
import app from "..";
import {jsonHeader} from "../lib/test.utils.ts";

describe("/api/company", () => {
    describe("create", () => {
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
                    name: `test-company-${Date.now()}`,
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
        test("Fails to upate: invalid payload", async () => {
            const res = await app.request("/api/company/1", {
                method: "PUT",
                body: JSON.stringify({
                    name: "",
                }),
                ...jsonHeader,
            });
            expect(res.status).toBe(400)
            const errorText = await res.text();
            expect(errorText).toInclude("Too small:");
            expect(errorText).toInclude("at name");
        })
        test("Fails to upate: empty path param", async () => {
            const res = await app.request("/api/company", {
                method: "PUT",
                body: JSON.stringify({
                    name: "helloNewName",
                }),
                ...jsonHeader,
            });
            expect(res.status).toBe(404)
            const errorText = await res.text();
            expect(errorText).toInclude("Not found");
        })
        test("Fails to upate: invalid company id", async () => {
            const res = await app.request("/api/company/invalidId", {
                method: "PUT",
                body: JSON.stringify({
                    name: "helloNewName",
                }),
                ...jsonHeader,
            });
            expect(res.status).toBe(404)
            const errorText = await res.text();
            expect(errorText).toInclude("Could not find company id");
        })
        test("Updates: invalid company id", async () => {
            const res = await app.request("/api/company/18", {
                method: "PUT",
                body: JSON.stringify({
                    name: "helloNewName",
                }),
                ...jsonHeader,
            });
            expect(res.status).toBe(201)
            const payload = await res.json();
            expect(payload).toHaveProperty("updatedId");
            expect(payload).toHaveProperty("updatedAt");
        })
    })
});
