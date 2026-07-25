import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { ordersTable } from "./orders";

/** Per-order chat between the customer, the assigned driver, and the store. */
export const orderMessagesTable = pgTable("order_messages", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  senderId: integer("sender_id").notNull().references(() => usersTable.id),
  senderRole: text("sender_role").notNull(), // customer | driver | restaurant_owner | admin
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type OrderMessage = typeof orderMessagesTable.$inferSelect;
