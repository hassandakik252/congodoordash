import { pgTable, serial, integer, real, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const driverSettlementsTable = pgTable("driver_settlements", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").notNull().references(() => usersTable.id),
  settledBy: integer("settled_by").notNull().references(() => usersTable.id),
  cashAmount: real("cash_amount").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type DriverSettlement = typeof driverSettlementsTable.$inferSelect;
