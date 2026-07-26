-- Generalize "restaurants" → "stores" across the schema (data-preserving rename).
-- Hand-written to ALTER ... RENAME rather than DROP/CREATE so existing rows,
-- FKs and the user_role enum are preserved. The drizzle snapshot for this
-- migration reflects the final (stores/products/store_owner) schema.

-- 1. Role enum value ---------------------------------------------------------
ALTER TYPE "public"."user_role" RENAME VALUE 'restaurant_owner' TO 'store_owner';--> statement-breakpoint

-- 2. Tables ------------------------------------------------------------------
ALTER TABLE "restaurants" RENAME TO "stores";--> statement-breakpoint
ALTER TABLE "menu_items" RENAME TO "products";--> statement-breakpoint

-- 3. Columns -----------------------------------------------------------------
ALTER TABLE "products" RENAME COLUMN "restaurant_id" TO "store_id";--> statement-breakpoint
ALTER TABLE "orders" RENAME COLUMN "restaurant_id" TO "store_id";--> statement-breakpoint
ALTER TABLE "orders" RENAME COLUMN "restaurant_name" TO "store_name";--> statement-breakpoint
ALTER TABLE "reviews" RENAME COLUMN "restaurant_id" TO "store_id";--> statement-breakpoint
ALTER TABLE "reviews" RENAME COLUMN "restaurant_rating" TO "store_rating";--> statement-breakpoint

-- 4. Foreign-key constraint names (keep drizzle's naming convention) ----------
ALTER TABLE "stores" RENAME CONSTRAINT "restaurants_owner_id_users_id_fk" TO "stores_owner_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "products" RENAME CONSTRAINT "menu_items_restaurant_id_restaurants_id_fk" TO "products_store_id_stores_id_fk";--> statement-breakpoint
ALTER TABLE "categories" RENAME CONSTRAINT "categories_store_id_restaurants_id_fk" TO "categories_store_id_stores_id_fk";--> statement-breakpoint
ALTER TABLE "orders" RENAME CONSTRAINT "orders_restaurant_id_restaurants_id_fk" TO "orders_store_id_stores_id_fk";--> statement-breakpoint
ALTER TABLE "reviews" RENAME CONSTRAINT "reviews_restaurant_id_restaurants_id_fk" TO "reviews_store_id_stores_id_fk";--> statement-breakpoint

-- 5. Primary-key constraint names --------------------------------------------
ALTER TABLE "stores" RENAME CONSTRAINT "restaurants_pkey" TO "stores_pkey";--> statement-breakpoint
ALTER TABLE "products" RENAME CONSTRAINT "menu_items_pkey" TO "products_pkey";
