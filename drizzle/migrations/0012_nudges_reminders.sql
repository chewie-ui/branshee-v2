ALTER TABLE "users" ADD COLUMN "signup_intent" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "nudges" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "limit_notice_month" text;--> statement-breakpoint
ALTER TABLE "business_plans" ADD COLUMN "grant_reminder" jsonb DEFAULT '{}'::jsonb NOT NULL;