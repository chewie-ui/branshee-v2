ALTER TABLE "business_plans" ADD COLUMN IF NOT EXISTS "offered_users" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "business_plans" ADD COLUMN IF NOT EXISTS "user_price_cents" integer;--> statement-breakpoint
ALTER TABLE "business_plans" ADD COLUMN IF NOT EXISTS "extra_user_price_cents" integer;
