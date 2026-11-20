ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "inami_conventioned" boolean;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "inami_code" text;--> statement-breakpoint
ALTER TABLE "care_episodes" ADD COLUMN IF NOT EXISTS "inami_place" text DEFAULT 'I.a)' NOT NULL;
