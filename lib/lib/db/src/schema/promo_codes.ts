import { pgTable, serial, text, timestamp, integer, real, boolean, pgEnum } from "drizzle-orm/pg-core";

export const discountTypeEnum = pgEnum("discount_type", ["fixed", "percent"]);

export const promoCodesTable = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  type: discountTypeEnum("type").notNull(),
  value: real("value").notNull(),              // CDF amount (fixed) or % (percent)
  minOrderAmount: real("min_order_amount"),     // minimum subtotal to apply
  maxUses: integer("max_uses"),                // null = unlimited
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at"),          // null = never expires
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PromoCode = typeof promoCodesTable.$inferSelect;
