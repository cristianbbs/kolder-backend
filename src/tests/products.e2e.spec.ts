import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

let app: any;

async function login(email: string, password: string) {
  const res = await request(app).post("/auth/login").send({ email, password });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

describe("Products allow-list E2E", () => {
  let admin: string; // COMPANY_ADMIN
  let u1: string;    // USER1
  let firstId: number;

  beforeAll(async () => {
    ({ app } = await import("../app.ts"));
    admin = await login("responsable@demo.cl", "TuPass123");
    u1    = await login("user1@demo.cl", "TuPass123");

    // lee catálogo completo con admin (mismo endpoint, mismo filtro)
    const all = await request(app).get("/products/catalog").set("Authorization", `Bearer ${admin}`);
    expect(all.status).toBe(200);
    const flat = (all.body.categories ?? []).flatMap((c: any) => c.products);
    expect(flat.length).toBeGreaterThan(0);
    firstId = flat[0].id;

    // habilita solo ese productId para companyId=1
    const put = await request(app)
      .put("/company/1/products/enabled")
      .set("Authorization", `Bearer ${admin}`)
      .send({ productIds: [firstId] });
    expect(put.status).toBe(200);
    expect(put.body.enabledProductIds).toContain(firstId);
  });

  it("Catálogo filtrado refleja la allow-list para USER1 (solo 1 producto)", async () => {
    const cat = await request(app).get("/products/catalog").set("Authorization", `Bearer ${u1}`);
    expect(cat.status).toBe(200);
    expect(cat.body.ok).toBe(true);
    const total = (cat.body.categories ?? []).reduce((acc: number, c: any) => acc + c.products.length, 0);
    expect(total).toBe(1);
    const ids = (cat.body.categories ?? []).flatMap((c: any) => c.products.map((p: any) => p.id));
    expect(ids).toContain(firstId);
  });

  it("Un USER no puede acceder a /company/allowed-products (403)", async () => {
    const res = await request(app).get("/company/allowed-products").set("Authorization", `Bearer ${u1}`);
    expect([403, 401]).toContain(res.status);
  });
});
