import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, usersTable, driverSettlementsTable } from "@workspace/db/schema";
import { eq, and, desc, gte, lte, sum, count, inArray } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildDriverEarningsForDriver(driverId: number) {
  return db
    .select()
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.driverId, driverId),
        eq(ordersTable.status, "delivered")
      )
    )
    .orderBy(desc(ordersTable.updatedAt));
}

function summarise(deliveries: any[]) {
  const earn = (o: any) => (o.deliveryFee ?? 0) + (o.tip ?? 0); // driver earns fee + tip
  const cash = deliveries.filter((o: any) => o.paymentMethod === "cash");
  const nonCash = deliveries.filter((o: any) => o.paymentMethod !== "cash");

  const totalDeliveries = deliveries.length;
  const totalDeliveryFees = deliveries.reduce((s: number, o: any) => s + (o.deliveryFee ?? 0), 0);
  const totalTips = deliveries.reduce((s: number, o: any) => s + (o.tip ?? 0), 0);
  const totalEarnings = totalDeliveryFees + totalTips; // gross driver earnings

  const totalCashCollected = cash.reduce((s: number, o: any) => s + (o.total ?? 0), 0);
  const cashEarnings = cash.reduce((s: number, o: any) => s + earn(o), 0);
  // Cash the driver holds beyond their own earnings is owed back to the company.
  const totalOwedToCompany = Math.max(0, totalCashCollected - cashEarnings);
  // Earnings on electronically-paid orders the company owes the driver.
  const netPayable = nonCash.reduce((s: number, o: any) => s + earn(o), 0);

  return { totalDeliveries, totalDeliveryFees, totalTips, totalEarnings, totalCashCollected, totalOwedToCompany, netPayable };
}

// GET /earnings — driver's own earnings
// ?period=today|week|all (default all)
router.get("/", requireAuth, requireRole("driver"), async (req: AuthRequest, res) => {
  const driverId = req.user!.id;
  const period = (req.query.period as string) || "all";

  let deliveries = await buildDriverEarningsForDriver(driverId);

  const now = new Date();
  if (period === "today") {
    const start = startOfDay(now);
    const end = endOfDay(now);
    deliveries = deliveries.filter((o: any) => {
      const d = new Date(o.updatedAt);
      return d >= start && d <= end;
    });
  } else if (period === "week") {
    const start = startOfWeek(now);
    deliveries = deliveries.filter((o: any) => new Date(o.updatedAt) >= start);
  }

  const summary = summarise(deliveries);

  res.json({
    ...summary,
    deliveries: deliveries.map((o: any) => ({
      id: o.id,
      restaurantName: o.restaurantName,
      deliveryAddress: o.deliveryAddress,
      paymentMethod: o.paymentMethod,
      total: o.total,
      deliveryFee: o.deliveryFee,
      cashConfirmed: o.cashConfirmed,
      deliveredAt: o.updatedAt,
    })),
  });
});

// GET /earnings/settlements — driver's own settlement history
router.get("/settlements", requireAuth, requireRole("driver"), async (req: AuthRequest, res) => {
  const settlements = await db
    .select({
      id: driverSettlementsTable.id,
      cashAmount: driverSettlementsTable.cashAmount,
      note: driverSettlementsTable.note,
      createdAt: driverSettlementsTable.createdAt,
    })
    .from(driverSettlementsTable)
    .where(eq(driverSettlementsTable.driverId, req.user!.id))
    .orderBy(desc(driverSettlementsTable.createdAt));

  res.json(settlements);
});

// ── Admin routes ──────────────────────────────────────────────────────────────

// GET /earnings/admin/drivers — all drivers' earnings + pending balance
router.get("/admin/drivers", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  // Fetch all drivers
  const drivers = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      phone: usersTable.phone,
      email: usersTable.email,
    })
    .from(usersTable)
    .where(eq(usersTable.role, "driver"));

  if (drivers.length === 0) {
    res.json([]);
    return;
  }

  const driverIds = drivers.map(d => d.id);

  // Batch query: all delivered orders for all drivers in one DB call
  const [allDeliveries, allSettlements] = await Promise.all([
    db
      .select()
      .from(ordersTable)
      .where(
        and(
          inArray(ordersTable.driverId, driverIds),
          eq(ordersTable.status, "delivered")
        )
      ),
    db
      .select()
      .from(driverSettlementsTable)
      .where(inArray(driverSettlementsTable.driverId, driverIds)),
  ]);

  // Group deliveries and settlements by driverId
  const deliveriesByDriver = new Map<number, typeof allDeliveries>();
  for (const order of allDeliveries) {
    if (order.driverId === null) continue;
    const list = deliveriesByDriver.get(order.driverId) ?? [];
    list.push(order);
    deliveriesByDriver.set(order.driverId, list);
  }

  const settlementsByDriver = new Map<number, typeof allSettlements>();
  for (const s of allSettlements) {
    const list = settlementsByDriver.get(s.driverId) ?? [];
    list.push(s);
    settlementsByDriver.set(s.driverId, list);
  }

  const results = drivers.map(driver => {
    const deliveries = deliveriesByDriver.get(driver.id) ?? [];
    const settlements = settlementsByDriver.get(driver.id) ?? [];

    const summary = summarise(deliveries);
    const totalSettled = settlements.reduce((s: number, st: any) => s + (st.cashAmount ?? 0), 0);
    const lastSettlement = [...settlements].sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0] ?? null;
    const pendingBalance = Math.max(0, summary.totalCashCollected - summary.totalEarnings - totalSettled);

    return {
      driver,
      ...summary,
      totalSettled,
      pendingBalance,
      lastSettledAt: lastSettlement?.createdAt ?? null,
      mismatch: summary.totalCashCollected > 0 && pendingBalance !== 0,
    };
  });

  res.json(results);
});

// GET /earnings/admin/drivers/:driverId — one driver's full breakdown
router.get("/admin/drivers/:driverId", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  const driverId = parseInt(String(req.params.driverId));
  if (isNaN(driverId)) {
    res.status(400).json({ error: "bad_request", message: "Invalid driver ID" });
    return;
  }

  const [driver] = await db
    .select({ id: usersTable.id, name: usersTable.name, phone: usersTable.phone, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, driverId))
    .limit(1);

  if (!driver) {
    res.status(404).json({ error: "not_found", message: "Driver not found" });
    return;
  }

  const deliveries = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.driverId, driverId), eq(ordersTable.status, "delivered")))
    .orderBy(desc(ordersTable.updatedAt));

  const summary = summarise(deliveries);

  const settlements = await db
    .select()
    .from(driverSettlementsTable)
    .where(eq(driverSettlementsTable.driverId, driverId))
    .orderBy(desc(driverSettlementsTable.createdAt));

  const totalSettled = settlements.reduce((s: number, st: any) => s + (st.cashAmount ?? 0), 0);
  const pendingBalance = Math.max(0, summary.totalCashCollected - summary.totalEarnings - totalSettled);

  res.json({
    driver,
    ...summary,
    totalSettled,
    pendingBalance,
    mismatch: summary.totalCashCollected > 0 && pendingBalance !== 0,
    deliveries: deliveries.map((o: any) => ({
      id: o.id,
      restaurantName: o.restaurantName,
      deliveryAddress: o.deliveryAddress,
      paymentMethod: o.paymentMethod,
      total: o.total,
      deliveryFee: o.deliveryFee,
      cashConfirmed: o.cashConfirmed,
      deliveredAt: o.updatedAt,
    })),
    settlements,
  });
});

// POST /earnings/admin/drivers/:driverId/settle — mark driver as settled
const settleSchema = z.object({
  cashAmount: z.number().positive(),
  note: z.string().optional(),
});

router.post("/admin/drivers/:driverId/settle", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  const driverId = parseInt(String(req.params.driverId));
  if (isNaN(driverId)) {
    res.status(400).json({ error: "bad_request", message: "Invalid driver ID" });
    return;
  }

  const parsed = settleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const [settlement] = await db
    .insert(driverSettlementsTable)
    .values({
      driverId,
      settledBy: req.user!.id,
      cashAmount: parsed.data.cashAmount,
      note: parsed.data.note ?? null,
    })
    .returning();

  res.json(settlement);
});

export default router;
