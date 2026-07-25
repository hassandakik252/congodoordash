import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidTransition, isClaimable, promoDiscount, type PromoLike } from "./orderRules";

test("isValidTransition: happy-path chain", () => {
  assert.ok(isValidTransition("pending", "confirmed"));
  assert.ok(isValidTransition("confirmed", "preparing"));
  assert.ok(isValidTransition("preparing", "ready_for_pickup"));
  assert.ok(isValidTransition("picked_up", "delivered"));
});

test("isValidTransition: any active state can cancel", () => {
  for (const s of ["pending", "confirmed", "preparing", "ready_for_pickup", "picked_up"]) {
    assert.ok(isValidTransition(s, "cancelled"), `${s} -> cancelled`);
  }
});

test("isValidTransition: terminal + illegal moves rejected", () => {
  assert.ok(!isValidTransition("delivered", "pending"));
  assert.ok(!isValidTransition("cancelled", "confirmed"));
  assert.ok(!isValidTransition("pending", "delivered"));
  assert.ok(!isValidTransition("ready_for_pickup", "picked_up")); // via /accept only
  assert.ok(!isValidTransition("nonsense", "confirmed"));
});

test("isClaimable: restaurants only at ready_for_pickup", () => {
  assert.ok(isClaimable("restaurant", "ready_for_pickup"));
  assert.ok(!isClaimable("restaurant", "confirmed"));
  assert.ok(!isClaimable("restaurant", "preparing"));
  assert.ok(!isClaimable("restaurant", "pending"));
});

test("isClaimable: other verticals claimable early", () => {
  for (const v of ["grocery", "retail", "pharmacy", "drinks"]) {
    assert.ok(isClaimable(v, "confirmed"), `${v} confirmed`);
    assert.ok(isClaimable(v, "preparing"), `${v} preparing`);
    assert.ok(isClaimable(v, "ready_for_pickup"), `${v} ready`);
    assert.ok(!isClaimable(v, "pending"), `${v} pending not claimable`);
    assert.ok(!isClaimable(v, "delivered"), `${v} delivered not claimable`);
  }
});

const base: PromoLike = { type: "fixed", value: 1000, isActive: true };

test("promoDiscount: fixed is capped at subtotal", () => {
  assert.equal(promoDiscount({ ...base, value: 1000 }, 5000), 1000);
  assert.equal(promoDiscount({ ...base, value: 8000 }, 5000), 5000);
});

test("promoDiscount: percent is rounded", () => {
  assert.equal(promoDiscount({ type: "percent", value: 10, isActive: true }, 5000), 500);
  assert.equal(promoDiscount({ type: "percent", value: 15, isActive: true }, 3333), 500); // 499.95 -> 500
});

test("promoDiscount: inactive / expired / used-up / under-minimum -> 0", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.equal(promoDiscount({ ...base, isActive: false }, 5000, now), 0);
  assert.equal(promoDiscount({ ...base, expiresAt: "2025-12-31T00:00:00Z" }, 5000, now), 0);
  assert.equal(promoDiscount({ ...base, maxUses: 5, usedCount: 5 }, 5000, now), 0);
  assert.equal(promoDiscount({ ...base, minOrderAmount: 6000 }, 5000, now), 0);
});

test("promoDiscount: valid within limits", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.equal(promoDiscount({ ...base, expiresAt: "2026-02-01T00:00:00Z", maxUses: 5, usedCount: 2, minOrderAmount: 3000 }, 5000, now), 1000);
});
