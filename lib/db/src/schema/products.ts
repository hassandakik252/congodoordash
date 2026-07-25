import { pgTable, serial, text, timestamp, integer, real, boolean, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { storesTable } from "./stores";

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
 *
 * The physical table is still named "menu_items" to avoid a data migration;
 * the code refers to it as `productsTable`. `menuItemsTable` is kept as a
 * backward-compatible alias. Column `restaurant_id` is likewise the store FK.
 */
export const productsTable = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  storeId: integer("restaurant_id").notNull().references(() => storesTable.id),
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
  requiresPrescription: boolean("requires_prescription").notNull().default(false), // pharmacy Rx items
  // Option groups (size, extras, ...). Each group has options with a price delta.
  modifiers: jsonb("modifiers").$type<Array<{
    name: string;
    required: boolean;
    multiple: boolean; // true = checkboxes, false = single choice
    options: Array<{ label: string; price: number }>;
  }> | null>(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;

// ── Backward-compatible aliases (pre-generalization names) ───────────────────
export const menuItemsTable = productsTable;
export const insertMenuItemSchema = insertProductSchema;
export type InsertMenuItem = InsertProduct;
export type MenuItem = Product;
