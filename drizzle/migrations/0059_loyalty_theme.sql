ALTER TABLE "loyalty_settings" ADD COLUMN IF NOT EXISTS "theme" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "loyalty_settings" ADD COLUMN IF NOT EXISTS "shop_rule" jsonb DEFAULT '{}'::jsonb NOT NULL;
