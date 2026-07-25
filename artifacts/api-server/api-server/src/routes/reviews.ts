import { Router } from "express";
import { db } from "@workspace/db";
import { reviewsTable, ordersTable, restaurantsTable } from "@workspace/db/schema";
import { eq, avg, count, and } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

const submitSchema = z.object({
  orderId: z.number().int().positive(),
  restaurantRating: z.number().int().min(1).max(5),
  driverRating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(400).optional(),
});

// POST /reviews — submit a review after delivery
router.post("/", requireAuth, requireRole("customer"), async (req: AuthRequest, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { orderId, restaurantRating, driverRating, comment } = parsed.data;
  const customerId = req.user!.id;

  // Verify order belongs to customer and is delivered
  const [order] = await db
    .select({ customerId: ordersTable.customerId, restaurantId: ordersTable.restaurantId, driverId: ordersTable.driverId, status: ordersTable.status })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "not_found", message: "Order not found" });
    return;
  }
  if (order.customerId !== customerId) {
    res.status(403).json({ error: "forbidden", message: "Not your order" });
    return;
  }
  if (order.status !== "delivered") {
    res.status(400).json({ error: "not_delivered", message: "Order not yet delivered" });
    return;
  }

  // Check for duplicate
  const [existing] = await db
    .select({ id: reviewsTable.id })
    .from(reviewsTable)
    .where(eq(reviewsTable.orderId, orderId))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "already_reviewed", message: "You already reviewed this order" });
    return;
  }

  // Insert review
  const [review] = await db.insert(reviewsTable).values({
    orderId,
    customerId,
    restaurantId: order.restaurantId,
    driverId: order.driverId ?? null,
    restaurantRating,
    driverRating: driverRating ?? null,
    comment: comment ?? null,
  }).returning();

  // Recalculate and update restaurant avg rating
  const [aggResult] = await db
    .select({ avg: avg(reviewsTable.restaurantRating), total: count(reviewsTable.id) })
    .from(reviewsTable)
    .where(eq(reviewsTable.restaurantId, order.restaurantId));

  if (aggResult && aggResult.avg !== null) {
    const newAvg = parseFloat(Number(aggResult.avg).toFixed(2));
    await db.update(restaurantsTable)
      .set({ rating: newAvg })
      .where(eq(restaurantsTable.id, order.restaurantId));
  }

  res.status(201).json(review);
});

// GET /reviews/check/:orderId — has the customer already reviewed this order?
router.get("/check/:orderId", requireAuth, async (req: AuthRequest, res) => {
  const orderId = parseInt(req.params.orderId);
  if (isNaN(orderId)) {
    res.status(400).json({ error: "bad_request" });
    return;
  }

  const [existing] = await db
    .select({ id: reviewsTable.id, restaurantRating: reviewsTable.restaurantRating, driverRating: reviewsTable.driverRating, comment: reviewsTable.comment })
    .from(reviewsTable)
    .where(and(eq(reviewsTable.orderId, orderId), eq(reviewsTable.customerId, req.user!.id)))
    .limit(1);

  res.json({ reviewed: !!existing, review: existing ?? null });
});

// GET /reviews/driver/:driverId/avg — average driver rating (admin/internal)
router.get("/driver/:driverId/avg", requireAuth, async (req: AuthRequest, res) => {
  const driverId = parseInt(req.params.driverId);
  if (isNaN(driverId)) {
    res.status(400).json({ error: "bad_request" });
    return;
  }

  const [result] = await db
    .select({ avg: avg(reviewsTable.driverRating), total: count(reviewsTable.id) })
    .from(reviewsTable)
    .where(eq(reviewsTable.driverId, driverId));

  const avgVal = result?.avg !== null ? parseFloat(Number(result?.avg ?? 0).toFixed(2)) : null;
  res.json({ avg: avgVal, count: result?.total ?? 0 });
});

export default router;
