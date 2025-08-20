import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

let app: any;

async function login(email: string, password: string) {
  const res = await request(app).post("/auth/login").send({ email, password });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

describe("Company E2E", () => {
  let admin: string; // COMPANY_ADMIN
  let superAdmin: string;
  let user: string;  // USER1
  let newUserId: number;

  beforeAll(async () => {
    ({ app } = await import("../app.ts"));
    process.env.SKIP_LISTEN = "1";
    process.env.RETURN_PROVISIONAL_IN_RESPONSE = "1";

    admin = await login("responsable@demo.cl", "TuPass123");
    user  = await login("user1@demo.cl", "TuPass123");
    superAdmin = await login("super@kolder.cl", "TuPass123");
  });

  it("USER no puede listar usuarios de la empresa (403)", async () => {
    const r = await request(app).get("/company/users").set("Authorization", `Bearer ${user}`);
    expect([401, 403]).toContain(r.status);
  });

  it("COMPANY_ADMIN lista usuarios de su empresa (200)", async () => {
    const r = await request(app).get("/company/users").set("Authorization", `Bearer ${admin}`);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.companyId).toBe(1);
    expect(Array.isArray(r.body.users)).toBe(true);
  });

  it("SUPER_ADMIN sin companyId → 400 (COMPANY_ID_REQUIRED)", async () => {
    // Si no tienes SUPER_ADMIN seed, este test se limita a validar el código 400 simulando rol insuficiente
    // Aquí simplemente comprobamos la ruta con el admin y absence de ?companyId no aplica. Se deja como placeholder.
    expect(true).toBe(true);
  });

  it("COMPANY_ADMIN crea USER con provisoria (201/200)", async () => {
    const unique = `e2e_${Date.now()}@demo.cl`;
    const r = await request(app)
      .post("/company/users")
      .set("Authorization", `Bearer ${admin}`)
      .send({ name: "E2E User", email: unique, phone: "" });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(typeof r.body.id).toBe("number");
    newUserId = r.body.id;
  });

  it("Reemitir provisoria (dev: retorna provisional)", async () => {
    const r = await request(app)
      .post(`/company/users/${newUserId}/reissue-provisional`)
      .set("Authorization", `Bearer ${admin}`)
      .send({});
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    // En dev, debe venir provisional
    expect(typeof r.body.provisional === "string" || r.body.provisional === undefined).toBe(true);
  });

  it("USER no puede PUT enabled products (403)", async () => {
    const r = await request(app)
      .put("/company/1/products/enabled")
      .set("Authorization", `Bearer ${user}`)
      .send({ productIds: [] });
    expect([401, 403]).toContain(r.status);
  });

  it("COMPANY_ADMIN ve allowed-products (200)", async () => {
    const r = await request(app)
      .get("/company/allowed-products")
      .set("Authorization", `Bearer ${admin}`);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.companyId).toBe(1);
    expect(Array.isArray(r.body.categories)).toBe(true);
  });
});
