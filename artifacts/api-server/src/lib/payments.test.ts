import { test } from "node:test";
import assert from "node:assert/strict";
import { getPaymentProvider } from "./payments";

test("getPaymentProvider: defaults to the mock sandbox", () => {
  const p = getPaymentProvider();
  assert.equal(p.name, "mock");
});

test("mock.initiate: returns a pending transaction id", async () => {
  const p = getPaymentProvider();
  const r = await p.initiate({ orderId: 42, amount: 5000, phone: "+243810000000", channel: "M-Pesa" });
  assert.match(r.transactionId, /^MOCK-42-/);
  assert.equal(r.status, "pending");
});

test("mock.parseWebhook: accepts valid, rejects malformed", () => {
  const p = getPaymentProvider();
  assert.deepEqual(p.parseWebhook({ transactionId: "MOCK-1", status: "confirmed" }), { transactionId: "MOCK-1", status: "confirmed" });
  assert.deepEqual(p.parseWebhook({ transactionId: "MOCK-1", status: "failed" }), { transactionId: "MOCK-1", status: "failed" });
  assert.equal(p.parseWebhook({ transactionId: "MOCK-1", status: "weird" }), null);
  assert.equal(p.parseWebhook({ status: "confirmed" }), null);
  assert.equal(p.parseWebhook(null), null);
  assert.equal(p.parseWebhook("nope"), null);
});

test("mock.verifyWebhook: no secret accepts; secret must match", () => {
  const p = getPaymentProvider();
  const prev = process.env.PAYMENT_WEBHOOK_SECRET;

  delete process.env.PAYMENT_WEBHOOK_SECRET;
  assert.ok(p.verifyWebhook({}, "{}"), "no secret configured → accept");

  process.env.PAYMENT_WEBHOOK_SECRET = "s3cr3t";
  assert.ok(p.verifyWebhook({ "x-webhook-secret": "s3cr3t" }, "{}"), "matching secret → accept");
  assert.ok(!p.verifyWebhook({ "x-webhook-secret": "wrong" }, "{}"), "wrong secret → reject");
  assert.ok(!p.verifyWebhook({}, "{}"), "missing secret → reject");

  if (prev === undefined) delete process.env.PAYMENT_WEBHOOK_SECRET;
  else process.env.PAYMENT_WEBHOOK_SECRET = prev;
});
