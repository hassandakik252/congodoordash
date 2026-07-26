import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, restaurantsTable, menuItemsTable, usersTable, reviewsTable, promoCodesTable } from "@workspace/db/schema";
import { eq, and, or, inArray, isNull, desc, sql, getTableColumns } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth";
import { z } from "zod";
import { createNotification, notifyAdmins } from "../lib/notify";
import { recomputeTotals } from "../lib/pricing";
import { isValidTransition, isClaimable, promoDiscount } from "../lib/orderRules";
import { getPaymentProvider } from "../lib/payments";
import { getCommissionPct } from "./settings";

const router = Router();

/** Thrown inside the create-order transaction when a stock-tracked product
 *  can't cover the requested quantity, so the whole order rolls back. */
class OutOfStockError extends Error {
  constructor(public itemName: string) {
    super(`Out of stock: ${itemName}`);
    this.name = "OutOfStockError";
  }
}

type OrderItem = (typeof ordersTable.$inferSelect)["items"][number];

const pickSchema = z.object({
  items: z.array(z.object({
    menuItemId: z.number().int().positive(),
    lineStatus: z.enum(["found", "out_of_stock", "substituted", "weight_adjusted"]),
    substituteName: z.string().optional(),
    finalPrice: z.number().nonnegative().optional(),
  })).min(1),
});

const approveSubsSchema = z.object({
  decisions: z.array(z.object({
    menuItemId: z.number().int().positive(),
    approved: z.boolean(),
  })).min(1),
});

const createOrderSchema = z.object({
  restaurantId: z.number().int().positive(),
  items: z.array(z.object({
    menuItemId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    modifiers: z.array(z.object({ groupName: z.string(), label: z.string() })).optional(),
  })).min(1),
  deliveryAddress: z.string().min(1),
  paymentMethod: z.enum(["cash", "mobile_money", "card"]),
  paymentProvider: z.string().optional(),   // "M-Pesa" | "Airtel Money"
  paymentReference: z.string().optional(),  // optional at order time; can be submitted later
  paymentPhone: z.string().optional(),
  notes: z.string().optional(),
  driverInstructions: z.string().optional(),
  promoCode: z.string().optional(),
  tip: z.number().nonnegative().optional(),
  scheduledFor: z.string().datetime({ offset: true }).optional(), // ISO; must be in the future
});

const updateStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "preparing", "ready_for_pickup", "picked_up", "delivered", "cancelled"]),
});

const submitPaymentSchema = z.object({
  reference: z.string().min(1),
  phone: z.string().optional(),
});

const initiatePaymentSchema = z.object({
  phone: z.string().optional(),   // required for mobile money, not for card
  channel: z.enum(["M-Pesa", "Airtel Money", "Card"]),
});

// GET /orders — role-filtered list, newest first
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const user = req.user!;
  let orders;

  if (user.role === "customer") {
    const rawOrders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.customerId, user.id))
      .orderBy(desc(ordersTable.createdAt));

    // Attach reviewed flag
    const reviewedIds = new Set(
      (await db.select({ orderId: reviewsTable.orderId }).from(reviewsTable).where(eq(reviewsTable.customerId, user.id)))
        .map(r => r.orderId)
    );
    orders = rawOrders.map(o => ({ ...o, reviewed: reviewedIds.has(o.id) }));
  } else if (user.role === "restaurant_owner") {
    const myRestaurants = await db
      .select({ id: restaurantsTable.id })
      .from(restaurantsTable)
      .where(eq(restaurantsTable.ownerId, user.id));
    const restaurantIds = myRestaurants.map(r => r.id);
    orders = restaurantIds.length > 0
      ? await db
          .select()
          .from(ordersTable)
          .where(inArray(ordersTable.restaurantId, restaurantIds))
          .orderBy(desc(ordersTable.createdAt))
      : [];
  } else {
    orders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.driverId, user.id))
      .orderBy(desc(ordersTable.updatedAt));
  }

  res.json(orders);
});

// POST /orders — create order (customer only)
router.post("/", requireAuth, requireRole("customer"), async (req: AuthRequest, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const {
    restaurantId, items, deliveryAddress,
    paymentMethod, paymentProvider, paymentReference, paymentPhone,
    notes, driverInstructions, promoCode, tip: tipInput, scheduledFor: scheduledForInput,
  } = parsed.data;
  const tip = tipInput ?? 0;

  let scheduledFor: Date | null = null;
  if (scheduledForInput) {
    const d = new Date(scheduledForInput);
    if (d.getTime() < Date.now() + 5 * 60 * 1000) {
      res.status(400).json({ error: "invalid_schedule", message: "L'heure programmée doit être au moins 5 minutes dans le futur." });
      return;
    }
    scheduledFor = d;
  }

  const [restaurant] = await db
    .select()
    .from(restaurantsTable)
    .where(eq(restaurantsTable.id, restaurantId))
    .limit(1);

  if (!restaurant) {
    res.status(404).json({ error: "not_found", message: "Restaurant not found" });
    return;
  }

  if (!restaurant.isOpen) {
    res.status(409).json({ error: "restaurant_closed", message: "Ce restaurant est actuellement fermé." });
    return;
  }

  // Fetch customer phone to store on order (for driver and restaurant visibility)
  const [customer] = await db
    .select({ phone: usersTable.phone })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.id))
    .limit(1);

  const menuItemIds = items.map(i => i.menuItemId);
  const menuItems = await db
    .select()
    .from(menuItemsTable)
    .where(inArray(menuItemsTable.id, menuItemIds));

  const menuItemMap = new Map(menuItems.map(m => [m.id, m]));

  let orderItems: OrderItem[];
  try {
  orderItems = items.map(i => {
    const menuItem = menuItemMap.get(i.menuItemId);
    if (!menuItem) throw new Error(`Menu item ${i.menuItemId} not found`);

    // Server-authoritative modifier pricing: validate each selected option
    // against the product's defined modifiers and take the price from the DB.
    const selected: Array<{ label: string; price: number }> = [];
    let modTotal = 0;
    for (const sel of i.modifiers ?? []) {
      const group = (menuItem.modifiers ?? []).find(g => g.name === sel.groupName);
      const opt = group?.options.find(o => o.label === sel.label);
      if (!opt) throw new Error(`Invalid modifier "${sel.label}" for item ${i.menuItemId}`);
      selected.push({ label: `${sel.groupName}: ${opt.label}`, price: opt.price });
      modTotal += opt.price;
    }

    const unitPrice = menuItem.price + modTotal;
    return {
      menuItemId: i.menuItemId,
      name: menuItem.name,
      price: unitPrice,
      quantity: i.quantity,
      ...(selected.length ? { modifiers: selected } : {}),
    };
  });
  } catch (e) {
    res.status(400).json({ error: "invalid_item", message: (e as Error).message });
    return;
  }

  const subtotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const deliveryFee = restaurant.deliveryFee;

  // Validate and apply promo code if provided
  let appliedPromo: { id: number; code: string; discountAmount: number } | null = null;
  if (promoCode) {
    const normalized = promoCode.trim().toUpperCase();
    const [promo] = await db
      .select()
      .from(promoCodesTable)
      .where(eq(promoCodesTable.code, normalized))
      .limit(1);

    if (promo) {
      const discountAmount = promoDiscount(promo, subtotal);
      if (discountAmount > 0) appliedPromo = { id: promo.id, code: promo.code, discountAmount };
    }
  }

  const discountAmount = appliedPromo?.discountAmount ?? 0;
  const total = Math.max(0, subtotal + deliveryFee - discountAmount + tip);

  // Platform commission on the merchandise (net of discount).
  const commissionPct = await getCommissionPct();
  const commission = Math.round(Math.max(0, subtotal - discountAmount) * commissionPct / 100);

  // If a reference is provided at order creation, mark as submitted immediately
  const initialPaymentStatus = paymentMethod === "mobile_money" && paymentReference
    ? "submitted"
    : "pending";

  // Products with a non-null stockQuantity are inventory-tracked (grocery /
  // retail / pharmacy); restaurants leave it null = unlimited. Decrement stock
  // atomically and create the order in one transaction so they never diverge
  // under concurrent orders. If any item can't cover the quantity, the whole
  // transaction rolls back and no stock is consumed.
  const stockTracked = orderItems
    .map(oi => ({ oi, product: menuItemMap.get(oi.menuItemId)! }))
    .filter(({ product }) => product?.stockQuantity !== null && product?.stockQuantity !== undefined);

  let order: typeof ordersTable.$inferSelect;
  try {
    order = await db.transaction(async (tx) => {
      for (const { oi } of stockTracked) {
        const decremented = await tx
          .update(menuItemsTable)
          .set({ stockQuantity: sql`${menuItemsTable.stockQuantity} - ${oi.quantity}` })
          .where(and(
            eq(menuItemsTable.id, oi.menuItemId),
            sql`${menuItemsTable.stockQuantity} >= ${oi.quantity}`,
          ))
          .returning({ id: menuItemsTable.id });
        if (decremented.length === 0) {
          throw new OutOfStockError(oi.name);
        }
      }

      const [inserted] = await tx
        .insert(ordersTable)
        .values({
          customerId: req.user!.id,
          restaurantId,
          restaurantName: restaurant.name,
          items: orderItems,
          deliveryAddress,
          paymentMethod,
          paymentStatus: initialPaymentStatus as any,
          paymentProvider: paymentProvider || null,
          paymentReference: paymentReference || null,
          paymentPhone: paymentPhone || null,
          paymentRequestedAt: (paymentMethod === "mobile_money" && paymentReference) ? new Date() : null,
          customerPhone: customer?.phone || null,
          driverInstructions: driverInstructions || null,
          subtotal,
          deliveryFee,
          total,
          notes,
          promoCode: appliedPromo?.code || null,
          discountAmount,
          tip,
          commission,
          scheduledFor,
        })
        .returning();

      // Increment promo usage in the same transaction so it only counts if the
      // order actually commits.
      if (appliedPromo) {
        await tx.update(promoCodesTable)
          .set({ usedCount: sql`${promoCodesTable.usedCount} + 1` })
          .where(eq(promoCodesTable.id, appliedPromo.id));
      }

      return inserted;
    });
  } catch (err) {
    if (err instanceof OutOfStockError) {
      res.status(409).json({
        error: "out_of_stock",
        message: `${err.itemName} est en rupture de stock ou la quantité demandée n'est pas disponible.`,
        item: err.itemName,
      });
      return;
    }
    throw err;
  }

  // Notify restaurant owner of new order
  createNotification({
    userId: restaurant.ownerId,
    type: "new_order",
    title: "Nouvelle commande !",
    body: `Commande #${order.id} reçue — ${orderItems.length} article(s) · ${total.toLocaleString()} CDF`,
    orderId: order.id,
  }).catch(err => console.error("[notify] Failed to notify restaurant owner for order", order.id, err));

  res.status(201).json(order);
});

// GET /orders/available — unclaimed orders a driver can take.
// Restaurants: ready_for_pickup (kitchen done). Grocery/retail/pharmacy/drinks
// (driver-also-shops): claimable earlier — at confirmed/preparing — so the
// driver can go shop the order. A `vertical` field is attached for the app.
router.get("/available", requireAuth, requireRole("driver"), async (req: AuthRequest, res) => {
  const orders = await db
    .select({ ...getTableColumns(ordersTable), vertical: restaurantsTable.vertical })
    .from(ordersTable)
    .leftJoin(restaurantsTable, eq(ordersTable.restaurantId, restaurantsTable.id))
    .where(
      and(
        isNull(ordersTable.driverId),
        // Scheduled orders only appear once their time is due.
        sql`(${ordersTable.scheduledFor} IS NULL OR ${ordersTable.scheduledFor} <= now())`,
        or(
          eq(ordersTable.status, "ready_for_pickup"),
          and(
            sql`${restaurantsTable.vertical} <> 'restaurant'`,
            inArray(ordersTable.status, ["confirmed", "preparing"]),
          ),
        ),
      ),
    )
    .orderBy(desc(ordersTable.updatedAt));

  res.json(orders);
});

// GET /orders/my-orders — driver's accepted orders
router.get("/my-orders", requireAuth, requireRole("driver"), async (req: AuthRequest, res) => {
  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.driverId, req.user!.id))
    .orderBy(desc(ordersTable.updatedAt));

  res.json(orders);
});

// GET /orders/:id — single order (ownership-gated)
router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ error: "bad_request", message: "Invalid order ID" });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, id))
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "not_found", message: "Order not found" });
    return;
  }

  const user = req.user!;

  // Admins can see any order; others must be the customer, the assigned driver,
  // or the owner of the restaurant the order was placed at.
  if (user.role !== "admin") {
    const isCustomer = order.customerId === user.id;
    const isDriver = order.driverId === user.id;

    let isRestaurantOwner = false;
    if (user.role === "restaurant_owner") {
      const [restaurant] = await db
        .select({ ownerId: restaurantsTable.ownerId })
        .from(restaurantsTable)
        .where(eq(restaurantsTable.id, order.restaurantId))
        .limit(1);
      isRestaurantOwner = restaurant?.ownerId === user.id;
    }

    if (!isCustomer && !isDriver && !isRestaurantOwner) {
      res.status(403).json({ error: "forbidden", message: "You do not have access to this order" });
      return;
    }
  }

  res.json(order);
});

// POST /orders/:id/accept — driver atomically claims an order
router.post("/:id/accept", requireAuth, requireRole("driver"), async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ error: "bad_request", message: "Invalid order ID" });
    return;
  }

  const driver = req.user!;

  // Look up current status + store vertical to decide claimability.
  const [existing] = await db
    .select({ status: ordersTable.status, driverId: ordersTable.driverId, vertical: restaurantsTable.vertical })
    .from(ordersTable)
    .leftJoin(restaurantsTable, eq(ordersTable.restaurantId, restaurantsTable.id))
    .where(eq(ordersTable.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "not_found", message: "Order not found" });
    return;
  }

  // Restaurants: claim only when ready_for_pickup. Other verticals (driver
  // shops): claim early at confirmed/preparing too. Either way → picked_up,
  // after which the driver shops (PATCH /pick) and then delivers.
  if (!isClaimable(existing.vertical, existing.status)) {
    res.status(409).json({ error: "not_claimable", message: "Cette commande n'est pas disponible pour le moment." });
    return;
  }

  // Atomic claim guarded by the exact current status + no existing driver.
  const updated = await db
    .update(ordersTable)
    .set({
      driverId: driver.id,
      status: "picked_up",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(ordersTable.id, id),
        eq(ordersTable.status, existing.status),
        isNull(ordersTable.driverId)
      )
    )
    .returning();

  if (updated.length === 0) {
    res.status(409).json({ error: "already_taken", message: "This order was already accepted by another driver" });
    return;
  }

  // Notify customer that a driver has accepted their order
  const accepted = updated[0];
  createNotification({
    userId: accepted.customerId,
    type: "driver_assigned",
    title: "Livreur en route 🛵",
    body: `Un livreur a accepté votre Commande #${id} et est en route.`,
    orderId: id,
  }).catch(err => console.error("[notify] Failed to notify customer of driver assignment for order", id, err));

  res.json(accepted);
});

// PATCH /orders/:id/confirm-cash — driver confirms cash received before marking delivered
router.patch("/:id/confirm-cash", requireAuth, requireRole("driver"), async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ error: "bad_request", message: "Invalid order ID" });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) {
    res.status(404).json({ error: "not_found", message: "Order not found" });
    return;
  }

  if (order.driverId !== req.user!.id) {
    res.status(403).json({ error: "forbidden", message: "Not your order" });
    return;
  }

  if (order.paymentMethod !== "cash") {
    res.status(400).json({ error: "not_cash", message: "Cash confirmation only applies to cash orders" });
    return;
  }

  if (order.status !== "picked_up") {
    res.status(409).json({ error: "wrong_status", message: "Order must be picked up before confirming cash" });
    return;
  }

  const [updated] = await db
    .update(ordersTable)
    .set({ cashConfirmed: true, updatedAt: new Date() })
    .where(eq(ordersTable.id, id))
    .returning();

  res.json(updated);
});

// PATCH /orders/:id/status — update status
router.patch("/:id/status", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ error: "bad_request", message: "Invalid order ID" });
    return;
  }

  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) {
    res.status(404).json({ error: "not_found", message: "Order not found" });
    return;
  }

  const user = req.user!;
  const { status } = parsed.data;

  if (user.role === "customer") {
    if (order.customerId !== user.id) {
      res.status(403).json({ error: "forbidden", message: "Not your order" });
      return;
    }
    if (status !== "cancelled") {
      res.status(403).json({ error: "forbidden", message: "Customers can only cancel orders" });
      return;
    }
  }

  if (user.role === "driver") {
    if (order.driverId !== user.id) {
      res.status(403).json({ error: "forbidden", message: "Not your order" });
      return;
    }
    if (status !== "delivered") {
      res.status(403).json({ error: "forbidden", message: "Drivers can only mark orders as delivered" });
      return;
    }
  }

  // Store owners may only touch orders at a store they own, and only the
  // preparation stages (pickup/delivery are the driver's actions).
  if (user.role === "restaurant_owner") {
    const [store] = await db
      .select({ ownerId: restaurantsTable.ownerId })
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, order.restaurantId))
      .limit(1);
    if (!store || store.ownerId !== user.id) {
      res.status(403).json({ error: "forbidden", message: "Not your store's order" });
      return;
    }
    if (!["confirmed", "preparing", "ready_for_pickup", "cancelled"].includes(status)) {
      res.status(403).json({ error: "forbidden", message: "Store owners can only manage preparation status" });
      return;
    }
  }

  // Anyone who isn't the customer, assigned driver, owning merchant, or an admin
  // has no business changing an order's status.
  if (!["customer", "driver", "restaurant_owner", "admin"].includes(user.role)) {
    res.status(403).json({ error: "forbidden", message: "Not permitted" });
    return;
  }

  // State machine: enforce valid status transitions
  if (!isValidTransition(order.status, status)) {
    res.status(409).json({
      error: "invalid_transition",
      message: `Cannot move order from "${order.status}" to "${status}"`,
    });
    return;
  }

  // Block delivery if cash not yet confirmed by driver
  if (status === "delivered" && order.paymentMethod === "cash" && !order.cashConfirmed && user.role === "driver") {
    res.status(409).json({
      error: "cash_not_confirmed",
      message: "Veuillez d'abord confirmer la réception des espèces avant de marquer comme livré.",
    });
    return;
  }

  // When delivered with cash, mark payment as paid (cash flow unchanged)
  const paymentStatus = status === "delivered" && order.paymentMethod === "cash" ? "paid" : undefined;

  let updated;
  if (status === "cancelled") {
    // Cancel + restore inventory + reverse promo usage, atomically and exactly
    // once (guarded against a concurrent double-cancel).
    updated = await db.transaction(async (tx) => {
      const [u] = await tx
        .update(ordersTable)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(and(eq(ordersTable.id, id), sql`${ordersTable.status} <> 'cancelled'`))
        .returning();
      if (!u) return null; // already cancelled by another request — do not restore twice

      for (const it of order.items) {
        await tx
          .update(menuItemsTable)
          .set({ stockQuantity: sql`${menuItemsTable.stockQuantity} + ${it.quantity}` })
          .where(and(eq(menuItemsTable.id, it.menuItemId), sql`${menuItemsTable.stockQuantity} IS NOT NULL`));
      }
      if (order.promoCode) {
        await tx
          .update(promoCodesTable)
          .set({ usedCount: sql`GREATEST(${promoCodesTable.usedCount} - 1, 0)` })
          .where(eq(promoCodesTable.code, order.promoCode));
      }
      return u;
    });

    if (!updated) {
      const [current] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
      res.json(current);
      return;
    }
  } else {
    [updated] = await db
      .update(ordersTable)
      .set({
        status,
        ...(paymentStatus ? { paymentStatus } : {}),
        updatedAt: new Date(),
      })
      .where(eq(ordersTable.id, id))
      .returning();
  }

  // Fire status-based notifications (non-blocking)
  const orderRef = `Commande #${id}`;
  if (status === "confirmed") {
    createNotification({
      userId: order.customerId,
      type: "order_confirmed",
      title: "Commande confirmée ✓",
      body: `${orderRef} a été confirmée par ${order.restaurantName}.`,
      orderId: id,
    }).catch(err => console.error("[notify] order_confirmed for order", id, err));
  } else if (status === "preparing") {
    createNotification({
      userId: order.customerId,
      type: "order_preparing",
      title: "En cours de préparation 🍳",
      body: `${orderRef} est en cours de préparation. Encore un peu de patience !`,
      orderId: id,
    }).catch(err => console.error("[notify] order_preparing for order", id, err));
  } else if (status === "ready_for_pickup") {
    createNotification({
      userId: order.customerId,
      type: "order_ready",
      title: "Prêt pour la livraison 🛵",
      body: `${orderRef} est prête — un livreur va bientôt prendre en charge.`,
      orderId: id,
    }).catch(err => console.error("[notify] order_ready for order", id, err));
  } else if (status === "delivered") {
    createNotification({
      userId: order.customerId,
      type: "order_delivered",
      title: "Livraison effectuée 🎉",
      body: `${orderRef} a été livrée. Bon appétit !`,
      orderId: id,
    }).catch(err => console.error("[notify] order_delivered for order", id, err));
  }

  res.json(updated);
});

/**
 * PATCH /orders/:id/payment — customer submits their mobile money reference
 *
 * Called after the customer has initiated the mobile money transfer and wants
 * to provide the transaction reference for admin review.
 * Transitions: pending → submitted
 *
 * Only the customer who owns the order can call this.
 * Only works for mobile_money orders in pending or submitted state
 * (allows updating a previously submitted reference before admin reviews it).
 */
router.patch("/:id/payment", requireAuth, requireRole("customer"), async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ error: "bad_request", message: "Invalid order ID" });
    return;
  }

  const parsed = submitPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) {
    res.status(404).json({ error: "not_found", message: "Order not found" });
    return;
  }

  if (order.customerId !== req.user!.id) {
    res.status(403).json({ error: "forbidden", message: "Not your order" });
    return;
  }

  if (order.paymentMethod !== "mobile_money") {
    res.status(400).json({ error: "not_mobile_money", message: "Payment reference only applies to mobile money orders" });
    return;
  }

  // Allow re-submission only while still pending or submitted (not yet reviewed by admin)
  if (!["pending", "submitted"].includes(order.paymentStatus)) {
    res.status(409).json({ error: "already_reviewed", message: "This payment has already been reviewed" });
    return;
  }

  const [updated] = await db
    .update(ordersTable)
    .set({
      paymentStatus: "submitted",
      paymentReference: parsed.data.reference,
      paymentPhone: parsed.data.phone || order.paymentPhone || null,
      paymentRequestedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(ordersTable.id, id))
    .returning();

  // Notify admins of new payment submission
  notifyAdmins({
    type: "payment_submitted",
    title: "Paiement Mobile Money soumis",
    body: `Commande #${id} — référence reçue, en attente de validation.`,
    orderId: id,
  }).catch(err => console.error("[notify] Failed to notify admins of payment submission for order", id, err));

  res.json(updated);
});

// PATCH /orders/:id/pick — shopper (assigned driver or the store owner) records
// picking results for a grocery/retail order: items found, out of stock,
// substituted, or weight-adjusted. Recomputes the order total. Proposed
// substitutions await customer approval.
router.patch("/:id/pick", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "bad_request", message: "Invalid order ID" }); return; }

  const parsed = pickSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "not_found", message: "Order not found" }); return; }

  const user = req.user!;
  // Authorize: assigned driver, the store's owner, or an admin.
  let isStoreOwner = false;
  if (user.role === "restaurant_owner") {
    const [store] = await db.select({ ownerId: restaurantsTable.ownerId })
      .from(restaurantsTable).where(eq(restaurantsTable.id, order.restaurantId)).limit(1);
    isStoreOwner = store?.ownerId === user.id;
  }
  const isAssignedDriver = order.driverId === user.id;
  if (user.role !== "admin" && !isStoreOwner && !isAssignedDriver) {
    res.status(403).json({ error: "forbidden", message: "Only the store or the assigned driver can pick this order" });
    return;
  }
  if (order.status === "delivered" || order.status === "cancelled") {
    res.status(409).json({ error: "invalid_state", message: "Order can no longer be picked" });
    return;
  }

  const updateMap = new Map(parsed.data.items.map(u => [u.menuItemId, u]));
  const newItems = order.items.map(line => {
    const u = updateMap.get(line.menuItemId);
    if (!u) return line;
    const next: typeof line = { ...line, lineStatus: u.lineStatus };
    if (u.lineStatus === "substituted") {
      next.substituteName = u.substituteName;
      next.finalPrice = u.finalPrice;
      next.approved = null; // reset — awaiting customer decision
    } else if (u.lineStatus === "weight_adjusted") {
      next.finalPrice = u.finalPrice;
    } else {
      // found / out_of_stock — clear any prior substitution fields
      next.substituteName = undefined;
      next.finalPrice = undefined;
      next.approved = undefined;
    }
    return next;
  });

  const { subtotal, total } = recomputeTotals(newItems, order.deliveryFee, order.discountAmount, order.tip);
  const [updated] = await db.update(ordersTable)
    .set({ items: newItems, subtotal, total, updatedAt: new Date() })
    .where(eq(ordersTable.id, id))
    .returning();

  const pendingSubs = newItems.filter(i => i.lineStatus === "substituted" && (i.approved === null || i.approved === undefined));
  if (pendingSubs.length > 0) {
    createNotification({
      userId: order.customerId,
      type: "order_preparing",
      title: "Article remplacé — votre accord ?",
      body: `Votre commande #${id} a ${pendingSubs.length} remplacement(s) à approuver.`,
      orderId: id,
    }).catch(err => console.error("[notify] Failed to notify customer of substitutions for order", id, err));
  }

  res.json(updated);
});

// PATCH /orders/:id/approve-substitutions — customer approves/rejects proposed
// substitutions. Rejected items are dropped and the total is recomputed.
router.patch("/:id/approve-substitutions", requireAuth, requireRole("customer"), async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "bad_request", message: "Invalid order ID" }); return; }

  const parsed = approveSubsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "not_found", message: "Order not found" }); return; }
  if (order.customerId !== req.user!.id) {
    res.status(403).json({ error: "forbidden", message: "Not your order" });
    return;
  }

  const decisionMap = new Map(parsed.data.decisions.map(d => [d.menuItemId, d.approved]));
  const newItems = order.items.map(line => {
    if (line.lineStatus !== "substituted") return line;
    const decision = decisionMap.get(line.menuItemId);
    if (decision === undefined) return line;
    return { ...line, approved: decision };
  });

  const { subtotal, total } = recomputeTotals(newItems, order.deliveryFee, order.discountAmount, order.tip);
  const [updated] = await db.update(ordersTable)
    .set({ items: newItems, subtotal, total, updatedAt: new Date() })
    .where(eq(ordersTable.id, id))
    .returning();

  res.json(updated);
});

// POST /orders/:id/pay — initiate an automated mobile-money charge via the
// configured payment provider (customer). The provider prompts the payer's
// phone and later confirms via POST /payments/webhook.
router.post("/:id/pay", requireAuth, requireRole("customer"), async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "bad_request", message: "Invalid order ID" }); return; }

  const parsed = initiatePaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "not_found", message: "Order not found" }); return; }
  if (order.customerId !== req.user!.id) { res.status(403).json({ error: "forbidden", message: "Not your order" }); return; }
  if (order.paymentMethod !== "mobile_money" && order.paymentMethod !== "card") {
    res.status(400).json({ error: "not_payable", message: "This order is not paid online" });
    return;
  }
  if (parsed.data.channel !== "Card" && !parsed.data.phone) {
    res.status(400).json({ error: "phone_required", message: "Le numéro de téléphone est requis pour Mobile Money." });
    return;
  }
  if (!["pending", "submitted", "failed"].includes(order.paymentStatus)) {
    res.status(409).json({ error: "already_settled", message: "Ce paiement est déjà réglé." });
    return;
  }

  let result;
  try {
    result = await getPaymentProvider().initiate({
      orderId: id,
      amount: order.total,
      phone: parsed.data.phone ?? "",
      channel: parsed.data.channel,
    });
  } catch (err) {
    console.error("[payments] initiate failed for order", id, err);
    res.status(502).json({ error: "provider_error", message: "Le fournisseur de paiement est indisponible. Réessayez." });
    return;
  }

  const [updated] = await db.update(ordersTable)
    .set({
      paymentStatus: "submitted",
      paymentProvider: parsed.data.channel,
      paymentPhone: parsed.data.phone ?? null,
      paymentReference: result.transactionId,
      paymentRequestedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(ordersTable.id, id))
    .returning();

  res.status(202).json({
    transactionId: result.transactionId,
    status: result.status,
    message: result.message ?? "Paiement initié. Confirmez sur votre téléphone.",
    order: updated,
  });
});

export default router;
