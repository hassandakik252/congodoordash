import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ordersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getPaymentProvider } from "../lib/payments";
import { createNotification } from "../lib/notify";

const router: IRouter = Router();

// POST /payments/webhook — provider callback confirming/declining a payment.
// Public (no JWT) but signature/secret-verified by the provider adapter.
router.post("/webhook", async (req, res) => {
  const provider = getPaymentProvider();

  if (!provider.verifyWebhook(req.headers, JSON.stringify(req.body))) {
    res.status(401).json({ error: "invalid_signature" });
    return;
  }

  const event = provider.parseWebhook(req.body);
  if (!event) {
    res.status(400).json({ error: "bad_event", message: "Unrecognized webhook payload" });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.paymentReference, event.transactionId))
    .limit(1);

  if (!order) {
    // 200 so the provider doesn't retry forever on an unknown/foreign txn.
    res.status(200).json({ ok: true, matched: false });
    return;
  }

  // Idempotent: ignore if already settled.
  if (order.paymentStatus === "confirmed" || order.paymentStatus === "paid") {
    res.status(200).json({ ok: true, alreadySettled: true });
    return;
  }

  const paymentStatus = event.status === "confirmed" ? "confirmed" : "failed";
  await db
    .update(ordersTable)
    .set({ paymentStatus, paymentConfirmedAt: new Date(), updatedAt: new Date() })
    .where(eq(ordersTable.id, order.id));

  createNotification({
    userId: order.customerId,
    type: event.status === "confirmed" ? "payment_confirmed" : "payment_failed",
    title: event.status === "confirmed" ? "Paiement confirmé ✅" : "Paiement échoué ❌",
    body: event.status === "confirmed"
      ? `Votre paiement pour la commande #${order.id} a été confirmé.`
      : `Le paiement de la commande #${order.id} a échoué. Réessayez.`,
    orderId: order.id,
  }).catch((err) => console.error("[payments] notify failed for order", order.id, err));

  res.status(200).json({ ok: true, matched: true, status: paymentStatus });
});

export default router;
