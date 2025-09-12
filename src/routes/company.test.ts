import { describe, expect, test } from "bun:test";
import app from "..";

const jsonHeader = {
  headers: new Headers({ "Content-Type": "application/json" }),
};

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
});
