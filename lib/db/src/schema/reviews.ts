import { pgTable, serial, integer, real, text, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { ordersTable } from "./orders";
import { storesTable } from "./stores";

export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  customerId: integer("customer_id").notNull().references(() => usersTable.id),
  storeId: integer("store_id").notNull().references(() => storesTable.id),
  driverId: integer("driver_id").references(() => usersTable.id),
  storeRating: integer("store_rating").notNull(),
  driverRating: integer("driver_rating"),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  uniqueOrder: unique("reviews_order_unique").on(t.orderId),
}));

export type Review = typeof reviewsTable.$inferSelect;
