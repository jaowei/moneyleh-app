import { describe, expect, test } from "bun:test";
import app from "..";

const jsonHeader = {
  headers: new Headers({ "Content-Type": "application/json" }),
};

describe("/api/company", () => {
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
    const errorText =await res.text() 
    expect(errorText).toInclude('Too small:')
    expect(errorText).toInclude('at name')
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
    expect(await res.json()).toHaveProperty("name")
  });
});
