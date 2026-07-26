ALTER TABLE "restaurants" ALTER COLUMN "delivery_fee" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "restaurants" ALTER COLUMN "delivery_fee" SET DEFAULT 2000;--> statement-breakpoint
ALTER TABLE "menu_items" ALTER COLUMN "price" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "subtotal" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "delivery_fee" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "total" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "discount_amount" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "tip" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "commission" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "driver_settlements" ALTER COLUMN "cash_amount" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "promo_codes" ALTER COLUMN "value" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "promo_codes" ALTER COLUMN "min_order_amount" SET DATA TYPE integer;