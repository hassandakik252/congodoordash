import { pgTable, serial, text, timestamp, integer, real, boolean, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * Store vertical. Drives the customer UI (menu vs. searchable catalog), the
 * order lifecycle (kitchen prep vs. in-store picking) and merchant tooling.
 * Existing restaurant rows default to "restaurant".
 */
export const verticalEnum = pgEnum("vertical", [
  "restaurant",
  "grocery",
  "pharmacy",
  "retail",
  "drinks",
]);

/**
 * Stores / merchants for all verticals. A store has a `vertical` (restaurant,
 * grocery, pharmacy, retail, drinks) that drives the customer UI and the order
 * lifecycle. Owned by a user with the `store_owner` role.
 */
export const storesTable = pgTable("stores", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => usersTable.id),
  vertical: verticalEnum("vertical").notNull().default("restaurant"),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  imageUrl: text("image_url"),
  rating: real("rating").notNull().default(4.5),
  deliveryTimeMin: integer("delivery_time_min").notNull().default(30),
  deliveryFee: integer("delivery_fee").notNull().default(2000),
  isOpen: boolean("is_open").notNull().default(true),
  openingHours: text("opening_hours"),
  // Structured weekly hours for auto open/close. Array of 7 (index 0=Sunday..
  // 6=Saturday); each is { open: "HH:MM", close: "HH:MM" } or null (closed).
  businessHours: jsonb("business_hours").$type<Array<{ open: string; close: string } | null> | null>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStoreSchema = createInsertSchema(storesTable).omit({ id: true, createdAt: true, rating: true });
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type Store = typeof storesTable.$inferSelect;
