import { pgTable, serial, text, timestamp, integer, real, pgEnum, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { restaurantsTable } from "./stores";

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "picked_up",
  "delivered",
  "cancelled",
]);

export const paymentMethodEnum = pgEnum("payment_method", ["cash", "mobile_money", "card"]);

/**
 * Payment status lifecycle
 *
 * Cash:          pending  →  paid          (auto on delivery, unchanged)
 * Mobile money:  pending  →  submitted  →  confirmed | failed
 *                                          (customer submits reference, admin reviews)
 *
 * "paid" is kept for backward-compatibility with existing cash orders.
 */
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "submitted",
  "confirmed",
  "failed",
  "paid",
]);

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => usersTable.id),
  driverId: integer("driver_id").references(() => usersTable.id),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id),
  restaurantName: text("restaurant_name").notNull(),
  status: orderStatusEnum("status").notNull().default("pending"),

  // ── Payment ─────────────────────────────────────────────────────────────────
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
  paymentProvider: text("payment_provider"),                   // "M-Pesa" | "Airtel Money" | null
  paymentReference: text("payment_reference"),                 // transaction ID entered by customer
  paymentPhone: text("payment_phone"),                         // phone used for mobile money
  paymentRequestedAt: timestamp("payment_requested_at"),       // when customer submitted reference
  paymentConfirmedAt: timestamp("payment_confirmed_at"),       // when admin confirmed or failed
  // ────────────────────────────────────────────────────────────────────────────

  deliveryAddress: text("delivery_address").notNull(),
  driverInstructions: text("driver_instructions"),
  customerPhone: text("customer_phone"),
  items: jsonb("items").notNull().$type<Array<{
    menuItemId: number;
    name: string;
    price: number;
    quantity: number;
    // ── Grocery picking / substitution state (optional; set during shopping) ──
    // "pending"       — not yet picked (default when absent)
    // "found"         — picked as ordered
    // "out_of_stock"  — unavailable; excluded from the recomputed total
    // "substituted"   — replaced; substituteName/finalPrice apply, needs customer approval
    // "weight_adjusted" — weight/variable item; finalPrice is the charged amount
    lineStatus?: "pending" | "found" | "out_of_stock" | "substituted" | "weight_adjusted";
    substituteName?: string;
    finalPrice?: number;              // charged line total (overrides price*quantity) for substitution/weight
    approved?: boolean | null;        // customer decision on a substitution (null/undefined = awaiting)
  }>>(),
  subtotal: real("subtotal").notNull(),
  deliveryFee: real("delivery_fee").notNull(),
  total: real("total").notNull(),
  notes: text("notes"),
  promoCode: text("promo_code"),
  discountAmount: real("discount_amount").notNull().default(0),
  tip: real("tip").notNull().default(0), // driver tip, added to total
  commission: real("commission").notNull().default(0), // platform cut (on subtotal)
  scheduledFor: timestamp("scheduled_for"), // null = ASAP; else deliver-at time
  cashConfirmed: boolean("cash_confirmed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
