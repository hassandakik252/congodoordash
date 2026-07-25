import { test } from "node:test";
import assert from "node:assert/strict";
import { lineTotal, recomputeTotals, type PricedLine } from "./pricing";

test("lineTotal: plain line uses price * quantity", () => {
  assert.equal(lineTotal({ price: 2500, quantity: 3 }), 7500);
  assert.equal(lineTotal({ price: 2500, quantity: 3, lineStatus: "found" }), 7500);
  assert.equal(lineTotal({ price: 2500, quantity: 3, lineStatus: "pending" }), 7500);
});

test("lineTotal: out of stock contributes 0", () => {
  assert.equal(lineTotal({ price: 8000, quantity: 1, lineStatus: "out_of_stock" }), 0);
});

test("lineTotal: substitution uses finalPrice unless rejected", () => {
  const base: PricedLine = { price: 8000, quantity: 1, lineStatus: "substituted", finalPrice: 8500 };
  assert.equal(lineTotal({ ...base }), 8500, "awaiting approval counts");
  assert.equal(lineTotal({ ...base, approved: null }), 8500, "null approval counts");
  assert.equal(lineTotal({ ...base, approved: true }), 8500, "approved counts");
  assert.equal(lineTotal({ ...base, approved: false }), 0, "rejected drops to 0");
});

test("lineTotal: substitution without finalPrice falls back to original", () => {
  assert.equal(lineTotal({ price: 8000, quantity: 2, lineStatus: "substituted" }), 16000);
});

test("lineTotal: weight_adjusted uses finalPrice", () => {
  assert.equal(lineTotal({ price: 2500, quantity: 1, lineStatus: "weight_adjusted", finalPrice: 3200 }), 3200);
  assert.equal(lineTotal({ price: 2500, quantity: 1, lineStatus: "weight_adjusted" }), 2500);
});

test("recomputeTotals: mirrors the live picking scenario", () => {
  // Riz found (25000) + Tomates weight 3200 + Lait substituted 8500, delivery 2500
  const items: PricedLine[] = [
    { price: 25000, quantity: 1, lineStatus: "found" },
    { price: 2500, quantity: 1, lineStatus: "weight_adjusted", finalPrice: 3200 },
    { price: 8000, quantity: 1, lineStatus: "substituted", finalPrice: 8500 },
  ];
  assert.deepEqual(recomputeTotals(items, 2500, 0), { subtotal: 36700, total: 39200 });

  // Customer rejects the substitution
  items[2].approved = false;
  assert.deepEqual(recomputeTotals(items, 2500, 0), { subtotal: 28200, total: 30700 });
});

test("recomputeTotals: applies discount and never goes negative", () => {
  const items: PricedLine[] = [{ price: 1000, quantity: 1 }];
  assert.deepEqual(recomputeTotals(items, 500, 200), { subtotal: 1000, total: 1300 });
  // Discount larger than subtotal+fee clamps total at 0
  assert.deepEqual(recomputeTotals(items, 500, 99999), { subtotal: 1000, total: 0 });
});
