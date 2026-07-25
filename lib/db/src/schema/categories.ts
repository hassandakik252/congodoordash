import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { storesTable } from "./stores";

/**
 * Product categories / aisles, per store. Grocery, retail and pharmacy catalogs
 * are large enough to need a browsable hierarchy (Produce → Fruit → Citrus),
 * so categories self-reference via parentId. Restaurants can ignore this table
 * and keep using the flat `menu_items.category` text tag.
 */
export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull().references(() => storesTable.id),
  name: text("name").notNull(),
  parentId: integer("parent_id"),        // self-FK for nested aisles; null = top level
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ id: true, createdAt: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categoriesTable.$inferSelect;
