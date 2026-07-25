/**
 * End-to-end API integration tests. These hit the real Express app against a
 * real Postgres database, so they are DB-gated: run only when DATABASE_URL
 * points at a throwaway test DB. Not part of the default `pnpm test` (unit)
 * run — see the `test:integration` script.
 *
 *   createdb deliverlbh_test
 *   DATABASE_URL=postgresql://.../deliverlbh_test \
 *     pnpm --filter @workspace/api-server run migrate   # from lib/db
 *   DATABASE_URL=... pnpm --filter @workspace/api-server run test:integration
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";

import app from "../app";
import { db, usersTable, restaurantsTable, menuItemsTable } from "@workspace/db";
import bcrypt from "bcryptjs";

let base = "";
let server: ReturnType<typeof app.listen>;
let storeId = 0;
let productId = 0;

async function j(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

before(async () => {
  server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

  // Minimal seed: an owner + a grocery store with one stocked product.
  const [owner] = await db.insert(usersTable).values({
    email: `itest-owner-${Date.now()}@x.com`, passwordHash: await bcrypt.hash("x", 4),
    name: "ITest Owner", phone: "+243000", role: "restaurant_owner", merchantStatus: "approved",
  }).returning();
  const [store] = await db.insert(restaurantsTable).values({
    ownerId: owner.id, vertical: "grocery", name: "ITest Mart", category: "Épicerie",
    address: "Av Test", phone: "+243111", deliveryFee: 1000, deliveryTimeMin: 30,
  }).returning();
  storeId = store.id;
  const [product] = await db.insert(menuItemsTable).values({
    storeId: store.id, name: "ITest Rice", price: 5000, category: "Céréales", stockQuantity: 5, unit: "pack",
  }).returning();
  productId = product.id;
});

after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

test("health check", async () => {
  const { status, data } = await j("GET", "/healthz");
  assert.equal(status, 200);
  assert.equal(data.status, "ok");
});

test("register requires accepting terms", async () => {
  const email = `itest-c-${Date.now()}@x.com`;
  const bad = await j("POST", "/auth/register", { email, password: "pass123", name: "C", phone: "+243", role: "customer" });
  assert.equal(bad.status, 400, "no acceptTerms → 400");
});

test("full order flow + inventory enforcement", async () => {
  const email = `itest-c2-${Date.now()}@x.com`;
  const reg = await j("POST", "/auth/register", { email, password: "pass123", name: "C", phone: "+243", role: "customer", acceptTerms: true });
  assert.equal(reg.status, 201);
  const token = reg.data.token as string;

  // Store visible in the (approved-owner) list
  const list = await j("GET", `/stores?vertical=grocery`);
  assert.equal(list.status, 200);
  assert.ok(list.data.some((s: any) => s.id === storeId), "grocery store listed");

  // Over-order (10 > stock 5) → 409 out_of_stock, stock untouched
  const over = await j("POST", "/orders", {
    restaurantId: storeId, items: [{ menuItemId: productId, quantity: 10 }],
    deliveryAddress: "Av", paymentMethod: "cash",
  }, token);
  assert.equal(over.status, 409);
  assert.equal(over.data.error, "out_of_stock");

  // Valid order (3 ≤ 5) → 201
  const ok = await j("POST", "/orders", {
    restaurantId: storeId, items: [{ menuItemId: productId, quantity: 3 }],
    deliveryAddress: "Av", paymentMethod: "cash",
  }, token);
  assert.equal(ok.status, 201);
  assert.equal(ok.data.subtotal, 15000);

  // Stock decremented 5 → 2
  const search = await j("GET", `/stores/${storeId}/products?search=ITest`);
  const p = search.data.items.find((i: any) => i.id === productId);
  assert.equal(p.stockQuantity, 2, "stock decremented atomically");
});

test("auth rate limiting kicks in", async () => {
  let saw429 = false;
  for (let i = 0; i < 12; i++) {
    const r = await j("POST", "/auth/login", { email: "nobody@x.com", password: "wrong" });
    if (r.status === 429) { saw429 = true; break; }
  }
  assert.ok(saw429, "429 after repeated bad logins");
});
