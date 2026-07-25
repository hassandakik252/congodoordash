import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Simple key/value application settings (single-row-per-key). Used for the
 * USD⇄CDF exchange rate and other tunables the admin sets at runtime.
 * Known keys: "usd_rate" (CDF per 1 USD).
 */
export const settingsTable = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSettingSchema = createInsertSchema(settingsTable);
export type Setting = typeof settingsTable.$inferSelect;
export type _InsertSetting = z.infer<typeof insertSettingSchema>;
