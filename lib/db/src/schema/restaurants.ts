import { pgTable, serial, text, timestamp, integer, real, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * Store vertical. Drives the customer UI (menu vs. searchable catalog), the
 * order lifecycle (kitchen prep vs. in-store picking) and merchant tooling.
 * Existing restaurant rows default to "restaurant" so this change is additive.
 */
export const verticalEnum = pgEnum("vertical", [
  "restaurant",
  "grocery",
  "pharmacy",
  "retail",
  "drinks",
]);

export const restaurantsTable = pgTable("restaurants", {
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
  deliveryFee: real("delivery_fee").notNull().default(2000),
  isOpen: boolean("is_open").notNull().default(true),
  openingHours: text("opening_hours"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRestaurantSchema = createInsertSchema(restaurantsTable).omit({ id: true, createdAt: true, rating: true });
export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type Restaurant = typeof restaurantsTable.$inferSelect;
