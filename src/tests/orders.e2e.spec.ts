import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

let app: any;

async function login(email: string, password: string) {
  const res = await request(app).post("/auth/login").send({ email, password });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

describe("Orders E2E", () => {
  let u1: string;      // USER1
  let u2: string;      // USER2
  let admin: string;   // COMPANY_ADMIN
  let orderId: number;
  let prodId: number;

  beforeAll(async () => {
    process.env.SKIP_LISTEN = "1";
    // @ts-expect-error: import dinámico de Vitest con extensión .ts
    ({ app } = await import("../app.ts"));

    u1    = await login("user1@demo.cl", "TuPass123");
    u2    = await login("user2@demo.cl", "NuevaSegura123!");
    admin = await login("responsable@demo.cl", "TuPass123");

    const cat = await request(app).get("/products/catalog").set("Authorization", `Bearer ${u1}`);
    expect(cat.status).toBe(200);
    const flat = (cat.body.categories ?? []).flatMap((c: any) => c.products);
    expect(flat.length).toBeGreaterThan(0);
    prodId = flat[0].id;

    const create = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${u1}`)
      .send({ items: [{ productId: prodId, quantity: 1 }], note: "e2e" });
    expect(create.status).toBe(201);
    orderId = create.body.id;
  });

  it("USER2 no puede leer pedido de USER1 (404)", async () => {
    const res = await request(app).get(`/orders/${orderId}`).set("Authorization", `Bearer ${u2}`);
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("USER no puede cambiar estado (403)", async () => {
    const res = await request(app)
      .put(`/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${u1}`)
      .send({ status: "PREPARING" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("ADMIN hace transición válida a PREPARING (200)", async () => {
    const res = await request(app)
      .put(`/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ status: "PREPARING" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.order.status).toBe("PREPARING");
  });

  it("ADMIN transición inválida DELIVERED desde PREPARING (409)", async () => {
    const res = await request(app)
      .put(`/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ status: "DELIVERED" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INVALID_TRANSITION");
  });

  it("Detalle incluye statusLogs y estado actual", async () => {
    const res = await request(app).get(`/orders/${orderId}`).set("Authorization", `Bearer ${u1}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.order.id).toBe(orderId);
    expect(Array.isArray(res.body.order.statusLogs)).toBe(true);
    expect(res.body.order.status).toBe("PREPARING");
  });
});
