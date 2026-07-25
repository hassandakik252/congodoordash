import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ordersTable, orderMessagesTable, restaurantsTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { createNotification } from "../lib/notify";
import { z } from "zod";

const router: IRouter = Router();

/** Is this user a participant of the order (customer / assigned driver / store owner / admin)? */
async function participantOf(order: { customerId: number; driverId: number | null; restaurantId: number }, user: { id: number; role: string }): Promise<boolean> {
  if (user.role === "admin") return true;
  if (order.customerId === user.id) return true;
  if (order.driverId === user.id) return true;
  if (user.role === "restaurant_owner") {
    const [store] = await db.select({ ownerId: restaurantsTable.ownerId })
      .from(restaurantsTable).where(eq(restaurantsTable.id, order.restaurantId)).limit(1);
    if (store?.ownerId === user.id) return true;
  }
  return false;
}

async function loadOrderAndAuthorize(id: number, user: { id: number; role: string }) {
  const [order] = await db
    .select({ id: ordersTable.id, customerId: ordersTable.customerId, driverId: ordersTable.driverId, restaurantId: ordersTable.restaurantId })
    .from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) return { error: "not_found" as const };
  if (!(await participantOf(order, user))) return { error: "forbidden" as const };
  return { order };
}

// GET /orders/:id/messages — full thread (participants only).
router.get("/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "bad_request" }); return; }
  const r = await loadOrderAndAuthorize(id, req.user!);
  if (r.error === "not_found") { res.status(404).json({ error: "not_found" }); return; }
  if (r.error === "forbidden") { res.status(403).json({ error: "forbidden" }); return; }

  const messages = await db.select().from(orderMessagesTable)
    .where(eq(orderMessagesTable.orderId, id))
    .orderBy(asc(orderMessagesTable.createdAt));
  res.json(messages);
});

// POST /orders/:id/messages — send a message.
router.post("/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "bad_request" }); return; }
  const parsed = z.object({ body: z.string().min(1).max(2000) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "validation_error", message: parsed.error.message }); return; }

  const r = await loadOrderAndAuthorize(id, req.user!);
  if (r.error === "not_found") { res.status(404).json({ error: "not_found" }); return; }
  if (r.error === "forbidden") { res.status(403).json({ error: "forbidden" }); return; }
  const order = r.order!;

  const [msg] = await db.insert(orderMessagesTable).values({
    orderId: id, senderId: req.user!.id, senderRole: req.user!.role, body: parsed.data.body,
  }).returning();

  // Notify the other participants (customer + assigned driver) besides the sender.
  const recipients = new Set<number>();
  if (order.customerId !== req.user!.id) recipients.add(order.customerId);
  if (order.driverId && order.driverId !== req.user!.id) recipients.add(order.driverId);
  for (const uid of recipients) {
    createNotification({
      userId: uid, type: "new_order", title: `Message — Commande #${id}`,
      body: parsed.data.body.slice(0, 80), orderId: id,
    }).catch((err) => console.error("[chat] notify failed", err));
  }

  res.status(201).json(msg);
});

export default router;
