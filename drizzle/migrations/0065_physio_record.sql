ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "niss_enc" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "niss_hash" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "birth_date" date;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "sex" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "mutuality" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "mutuality_number" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "prescriber_name" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "prescriber_inami" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "gp_name" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "gp_inami" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customers_business_niss_uq" ON "customers" USING btree ("business_id","niss_hash") WHERE "customers"."niss_hash" is not null;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "auto_lock_minutes" integer;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "care_episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL REFERENCES "businesses"("id") ON DELETE cascade,
	"customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE cascade,
	"title" text NOT NULL,
	"prescriber_name" text,
	"prescriber_inami" text,
	"prescription_date" date,
	"sessions_prescribed" integer,
	"pathology_kind" text DEFAULT 'courante' NOT NULL,
	"nomenclature" text,
	"approval_start" date,
	"approval_end" date,
	"status" text DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	"created_by_id" uuid REFERENCES "users"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "care_episodes_customer_idx" ON "care_episodes" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "care_episodes_business_idx" ON "care_episodes" USING btree ("business_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "care_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL REFERENCES "businesses"("id") ON DELETE cascade,
	"episode_id" uuid NOT NULL REFERENCES "care_episodes"("id") ON DELETE cascade,
	"entry_key" uuid NOT NULL,
	"section" text NOT NULL,
	"version" integer NOT NULL,
	"content_enc" text,
	"entry_date" date,
	"deleted" integer DEFAULT 0 NOT NULL,
	"author_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
	"author_name" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "care_entries_episode_idx" ON "care_entries" USING btree ("episode_id","section");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "care_entries_key_version_uq" ON "care_entries" USING btree ("entry_key","version");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "record_access_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL REFERENCES "businesses"("id") ON DELETE cascade,
	"customer_id" uuid REFERENCES "customers"("id") ON DELETE set null,
	"user_id" uuid REFERENCES "users"("id") ON DELETE set null,
	"user_name" text DEFAULT '' NOT NULL,
	"action" text NOT NULL,
	"detail" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_access_business_idx" ON "record_access_logs" USING btree ("business_id","at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_access_customer_idx" ON "record_access_logs" USING btree ("customer_id","at");
