ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "promo_cents" integer;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "promo_until" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "theme" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "options" jsonb DEFAULT '[]'::jsonb NOT NULL;
