import { pgTable, serial, text, timestamp, pgEnum, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["customer", "restaurant_owner", "driver", "admin"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  role: userRoleEnum("role").notNull().default("customer"),
  address: text("address"),
  savedAddresses: jsonb("saved_addresses").$type<Array<{ label: string; address: string }>>(),
  isActive: boolean("is_active").notNull().default(true),
  driverStatus: text("driver_status"), // 'pending' | 'approved' | 'rejected' | null (drivers only)
  merchantStatus: text("merchant_status"), // 'pending' | 'approved' | 'rejected' | null (store owners only)
  vehicleType: text("vehicle_type"),   // company-assigned vehicle label (company owns the fleet)
  expoPushToken: text("expo_push_token"), // Expo push token for future server-side push delivery
  termsAcceptedAt: timestamp("terms_accepted_at"), // when the user accepted Terms & Privacy
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
