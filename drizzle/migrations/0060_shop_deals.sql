ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "deals" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "photo_fit" text DEFAULT 'cover' NOT NULL;
