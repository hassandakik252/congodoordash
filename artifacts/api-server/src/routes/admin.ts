import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, restaurantsTable, ordersTable, reviewsTable } from "@workspace/db/schema";
import { avg, count, eq, ilike, or, desc, sql, and } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth";
import { z } from "zod";
import { createNotification } from "../lib/notify";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/stats", async (_req, res) => {
  try {
    const [totalOrders] = await db.select({ count: sql<number>`count(*)` }).from(ordersTable);
    const [deliveredOrders] = await db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "delivered"));
    const [activeOrders] = await db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(sql`${ordersTable.status} NOT IN ('delivered', 'cancelled')`);
    const [revenue] = await db.select({ total: sql<number>`COALESCE(SUM(${ordersTable.total}), 0)` }).from(ordersTable).where(eq(ordersTable.status, "delivered"));
    const [totalRestaurants] = await db.select({ count: sql<number>`count(*)` }).from(restaurantsTable);
    const [totalCustomers] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.role, "customer"));
    const [totalDrivers] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.role, "driver"));
    const [pendingDrivers] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(sql`${usersTable.role} = 'driver' AND ${usersTable.driverStatus} = 'pending'`);
    const [pendingPayments] = await db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(sql`${ordersTable.paymentMethod} = 'mobile_money' AND ${ordersTable.paymentStatus} = 'submitted'`);

    res.json({
      totalOrders: Number(totalOrders.count),
      deliveredOrders: Number(deliveredOrders.count),
      activeOrders: Number(activeOrders.count),
      revenue: Number(revenue.total),
      totalRestaurants: Number(totalRestaurants.count),
      totalCustomers: Number(totalCustomers.count),
      totalDrivers: Number(totalDrivers.count),
      pendingDrivers: Number(pendingDrivers.count),
      pendingPayments: Number(pendingPayments.count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.get("/orders", async (req, res) => {
  try {
    const { status } = req.query as { status?: string };
    let query = db
      .select({
        id: ordersTable.id,
        status: ordersTable.status,
        paymentMethod: ordersTable.paymentMethod,
        paymentStatus: ordersTable.paymentStatus,
        paymentProvider: ordersTable.paymentProvider,
        paymentReference: ordersTable.paymentReference,
        paymentPhone: ordersTable.paymentPhone,
        paymentRequestedAt: ordersTable.paymentRequestedAt,
        paymentConfirmedAt: ordersTable.paymentConfirmedAt,
        deliveryAddress: ordersTable.deliveryAddress,
        total: ordersTable.total,
        subtotal: ordersTable.subtotal,
        deliveryFee: ordersTable.deliveryFee,
        createdAt: ordersTable.createdAt,
        customerId: ordersTable.customerId,
        driverId: ordersTable.driverId,
        restaurantId: ordersTable.restaurantId,
        customerName: usersTable.name,
        restaurantName: restaurantsTable.name,
      })
      .from(ordersTable)
      .leftJoin(usersTable, eq(ordersTable.customerId, usersTable.id))
      .leftJoin(restaurantsTable, eq(ordersTable.restaurantId, restaurantsTable.id))
      .orderBy(desc(ordersTable.createdAt))
      .$dynamic();

    if (status && status !== "all") {
      query = query.where(eq(ordersTable.status, status as typeof ordersTable.status._.data));
    }

    const orders = await query.limit(200);
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

router.get("/restaurants", async (req, res) => {
  try {
    const { search } = req.query as { search?: string };
    let query = db
      .select({
        id: restaurantsTable.id,
        name: restaurantsTable.name,
        category: restaurantsTable.category,
        address: restaurantsTable.address,
        phone: restaurantsTable.phone,
        rating: restaurantsTable.rating,
        deliveryTimeMin: restaurantsTable.deliveryTimeMin,
        deliveryFee: restaurantsTable.deliveryFee,
        isOpen: restaurantsTable.isOpen,
        createdAt: restaurantsTable.createdAt,
        ownerName: usersTable.name,
        ownerEmail: usersTable.email,
      })
      .from(restaurantsTable)
      .leftJoin(usersTable, eq(restaurantsTable.ownerId, usersTable.id))
      .orderBy(desc(restaurantsTable.createdAt))
      .$dynamic();

    if (search) {
      query = query.where(
        or(
          ilike(restaurantsTable.name, `%${search}%`),
          ilike(restaurantsTable.category, `%${search}%`),
          ilike(restaurantsTable.address, `%${search}%`)
        )
      );
    }

    const restaurants = await query.limit(200);
    res.json(restaurants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch restaurants" });
  }
});

router.patch("/restaurants/:id/toggle", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id)).limit(1);
    if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }
    const [updated] = await db
      .update(restaurantsTable)
      .set({ isOpen: !restaurant.isOpen })
      .where(eq(restaurantsTable.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to toggle restaurant" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const { role, search } = req.query as { role?: string; search?: string };

    const baseSelect = {
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      phone: usersTable.phone,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    };

    let whereCondition;
    const notAdmin = sql`${usersTable.role} != 'admin'`;

    if (search && role && role !== "all") {
      whereCondition = sql`${usersTable.role} != 'admin'
        AND ${usersTable.role} = ${role}
        AND (${usersTable.name} ILIKE ${'%' + search + '%'} OR ${usersTable.email} ILIKE ${'%' + search + '%'})`;
    } else if (search) {
      whereCondition = sql`${usersTable.role} != 'admin'
        AND (${usersTable.name} ILIKE ${'%' + search + '%'} OR ${usersTable.email} ILIKE ${'%' + search + '%'})`;
    } else if (role && role !== "all") {
      whereCondition = sql`${usersTable.role} = ${role} AND ${usersTable.role} != 'admin'`;
    } else {
      whereCondition = notAdmin;
    }

    const users = await db
      .select(baseSelect)
      .from(usersTable)
      .where(whereCondition)
      .orderBy(desc(usersTable.createdAt))
      .limit(200);

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ── Driver management ─────────────────────────────────────────────────────────

router.get("/drivers", async (req, res) => {
  try {
    const { status } = req.query as { status?: string };
    let query = db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        phone: usersTable.phone,
        isActive: usersTable.isActive,
        driverStatus: usersTable.driverStatus,
        vehicleType: usersTable.vehicleType,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(
        status && status !== "all"
          ? sql`${usersTable.role} = 'driver' AND ${usersTable.driverStatus} = ${status}`
          : eq(usersTable.role, "driver")
      )
      .orderBy(desc(usersTable.createdAt))
      .$dynamic();

    const drivers = await query;

    // Attach avg driver rating from reviews
    const ratings = await db
      .select({
        driverId: reviewsTable.driverId,
        avgRating: avg(reviewsTable.driverRating),
        ratingCount: count(reviewsTable.id),
      })
      .from(reviewsTable)
      .where(sql`${reviewsTable.driverId} is not null`)
      .groupBy(reviewsTable.driverId);

    const ratingMap = new Map(ratings.map(r => [r.driverId, { avg: parseFloat(Number(r.avgRating ?? 0).toFixed(1)), count: r.ratingCount }]));

    const result = drivers.map(d => ({
      ...d,
      avgRating: ratingMap.get(d.id)?.avg ?? null,
      ratingCount: ratingMap.get(d.id)?.count ?? 0,
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch drivers" });
  }
});

router.patch("/drivers/:id/approve", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: "bad_request" }); return; }

    const [driver] = await db.select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!driver) { res.status(404).json({ error: "not_found" }); return; }
    if (driver.role !== "driver") { res.status(400).json({ error: "not_a_driver" }); return; }

    const [updated] = await db.update(usersTable)
      .set({ driverStatus: "approved", isActive: true })
      .where(eq(usersTable.id, id))
      .returning({ id: usersTable.id, driverStatus: usersTable.driverStatus, isActive: usersTable.isActive });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to approve driver" });
  }
});

router.patch("/drivers/:id/reject", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: "bad_request" }); return; }

    const [driver] = await db.select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!driver) { res.status(404).json({ error: "not_found" }); return; }
    if (driver.role !== "driver") { res.status(400).json({ error: "not_a_driver" }); return; }

    const [updated] = await db.update(usersTable)
      .set({ driverStatus: "rejected", isActive: false })
      .where(eq(usersTable.id, id))
      .returning({ id: usersTable.id, driverStatus: usersTable.driverStatus, isActive: usersTable.isActive });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reject driver" });
  }
});

// ── Payment management ────────────────────────────────────────────────────────

/**
 * GET /admin/payments — list mobile money orders, optionally filtered by paymentStatus
 * Query params: paymentStatus = pending | submitted | confirmed | failed | all
 */
router.get("/payments", async (req, res) => {
  try {
    const { paymentStatus } = req.query as { paymentStatus?: string };

    let query = db
      .select({
        id: ordersTable.id,
        status: ordersTable.status,
        paymentMethod: ordersTable.paymentMethod,
        paymentStatus: ordersTable.paymentStatus,
        paymentProvider: ordersTable.paymentProvider,
        paymentReference: ordersTable.paymentReference,
        paymentPhone: ordersTable.paymentPhone,
        paymentRequestedAt: ordersTable.paymentRequestedAt,
        paymentConfirmedAt: ordersTable.paymentConfirmedAt,
        total: ordersTable.total,
        createdAt: ordersTable.createdAt,
        customerId: ordersTable.customerId,
        customerName: usersTable.name,
        restaurantName: restaurantsTable.name,
      })
      .from(ordersTable)
      .leftJoin(usersTable, eq(ordersTable.customerId, usersTable.id))
      .leftJoin(restaurantsTable, eq(ordersTable.restaurantId, restaurantsTable.id))
      .where(
        paymentStatus && paymentStatus !== "all"
          ? and(eq(ordersTable.paymentMethod, "mobile_money"), sql`${ordersTable.paymentStatus} = ${paymentStatus}`)
          : eq(ordersTable.paymentMethod, "mobile_money")
      )
      .orderBy(desc(ordersTable.createdAt))
      .$dynamic();

    const payments = await query.limit(300);
    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

/**
 * PATCH /admin/payments/:id — admin manually confirms or fails a mobile money payment
 * Body: { action: "confirmed" | "failed" }
 */
router.patch("/payments/:id", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: "bad_request" }); return; }

    const parsed = z.object({ action: z.enum(["confirmed", "failed"]) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", message: "action must be 'confirmed' or 'failed'" });
      return;
    }

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "not_found" }); return; }
    if (order.paymentMethod !== "mobile_money") {
      res.status(400).json({ error: "not_mobile_money", message: "Only mobile money payments can be reviewed" });
      return;
    }
    if (!["pending", "submitted"].includes(order.paymentStatus)) {
      res.status(409).json({ error: "already_reviewed", message: "This payment has already been reviewed" });
      return;
    }

    const [updated] = await db
      .update(ordersTable)
      .set({
        paymentStatus: parsed.data.action,
        // Only stamp a confirmed-at timestamp when actually confirmed, not on failures
        ...(parsed.data.action === "confirmed" ? { paymentConfirmedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(ordersTable.id, id))
      .returning();

    // Notify the customer of the payment decision
    const isConfirmed = parsed.data.action === "confirmed";
    createNotification({
      userId: order.customerId,
      type: isConfirmed ? "payment_confirmed" : "payment_failed",
      title: isConfirmed ? "Paiement confirmé ✓" : "Paiement rejeté",
      body: isConfirmed
        ? `Votre paiement Mobile Money pour la commande #${id} a été confirmé.`
        : `Votre paiement Mobile Money pour la commande #${id} a été rejeté. Veuillez soumettre une nouvelle référence.`,
      orderId: id,
    }).catch(err => console.error("[notify] Failed to notify customer of payment decision for order", id, err));

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to review payment" });
  }
});

/**
 * GET /admin/analytics
 * Returns: ordersPerDay, revenuePerDay, topRestaurants
 * Optional query params: from, to (ISO date strings, default last 7 days)
 */
router.get("/analytics", async (req, res) => {
  try {
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 6);
    defaultFrom.setHours(0, 0, 0, 0);

    const fromDate = req.query.from ? new Date(req.query.from as string) : defaultFrom;
    const toDate = req.query.to ? new Date(req.query.to as string) : now;
    toDate.setHours(23, 59, 59, 999);

    // Orders per day
    const ordersPerDay = await db
      .select({
        day: sql<string>`DATE(${ordersTable.createdAt})`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(ordersTable)
      .where(sql`${ordersTable.createdAt} >= ${fromDate} AND ${ordersTable.createdAt} <= ${toDate}`)
      .groupBy(sql`DATE(${ordersTable.createdAt})`)
      .orderBy(sql`DATE(${ordersTable.createdAt})`);

    // Revenue per day (delivered orders only)
    const revenuePerDay = await db
      .select({
        day: sql<string>`DATE(${ordersTable.createdAt})`,
        revenue: sql<number>`COALESCE(SUM(${ordersTable.total}), 0)::float`,
      })
      .from(ordersTable)
      .where(
        sql`${ordersTable.status} = 'delivered'
          AND ${ordersTable.createdAt} >= ${fromDate}
          AND ${ordersTable.createdAt} <= ${toDate}`
      )
      .groupBy(sql`DATE(${ordersTable.createdAt})`)
      .orderBy(sql`DATE(${ordersTable.createdAt})`);

    // Top 5 restaurants by order count
    const topRestaurants = await db
      .select({
        restaurantId: ordersTable.restaurantId,
        restaurantName: ordersTable.restaurantName,
        orderCount: sql<number>`COUNT(*)::int`,
        revenue: sql<number>`COALESCE(SUM(${ordersTable.total}), 0)::float`,
      })
      .from(ordersTable)
      .where(sql`${ordersTable.createdAt} >= ${fromDate} AND ${ordersTable.createdAt} <= ${toDate}`)
      .groupBy(ordersTable.restaurantId, ordersTable.restaurantName)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(5);

    // Summary totals for the period
    const [totals] = await db
      .select({
        totalOrders: sql<number>`COUNT(*)::int`,
        totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${ordersTable.status} = 'delivered' THEN ${ordersTable.total} ELSE 0 END), 0)::float`,
        cancelledOrders: sql<number>`COUNT(CASE WHEN ${ordersTable.status} = 'cancelled' THEN 1 END)::int`,
      })
      .from(ordersTable)
      .where(sql`${ordersTable.createdAt} >= ${fromDate} AND ${ordersTable.createdAt} <= ${toDate}`);

    res.json({
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      totals,
      ordersPerDay,
      revenuePerDay,
      topRestaurants,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

router.patch("/users/:id/toggle", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.role === "admin") { res.status(403).json({ error: "Cannot deactivate admin" }); return; }
    const [updated] = await db
      .update(usersTable)
      .set({ isActive: !user.isActive })
      .where(eq(usersTable.id, id))
      .returning({ id: usersTable.id, isActive: usersTable.isActive });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to toggle user" });
  }
});

export default router;
