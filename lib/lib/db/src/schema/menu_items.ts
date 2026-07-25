import { pgTable, serial, text, timestamp, integer, real, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { restaurantsTable } from "./restaurants";

/**
 * Unit a product is sold by. Restaurants use "each"; grocery/retail may sell
 * produce or bulk goods by weight/volume, where the final charged price can
 * differ from the listed estimate.
 */
export const productUnitEnum = pgEnum("product_unit", [
  "each",
  "kg",
  "g",
  "L",
  "pack",
]);

/**
 * Products for all verticals (was "menu items"). Restaurants use name / price /
 * category / isAvailable and leave the grocery fields null. Grocery, retail and
 * pharmacy stores additionally use stockQuantity (inventory), unit, sku, brand
 * and categoryId (aisle). stockQuantity = null means "unlimited" (restaurants).
 */
export const menuItemsTable = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  category: text("category").notNull(),
  imageUrl: text("image_url"),
  isAvailable: boolean("is_available").notNull().default(true),

  // ── Grocery / retail / pharmacy fields (null for restaurants) ───────────────
  categoryId: integer("category_id"),          // FK to categories (aisle); soft ref
  stockQuantity: integer("stock_quantity"),    // inventory on hand; null = unlimited
  unit: productUnitEnum("unit").notNull().default("each"),
  sku: text("sku"),                            // stock-keeping unit
  barcode: text("barcode"),
  brand: text("brand"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMenuItemSchema = createInsertSchema(menuItemsTable).omit({ id: true, createdAt: true });
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type MenuItem = typeof menuItemsTable.$inferSelect;
