ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "inami" text;--> statement-breakpoint
ALTER TABLE "care_entries" ADD COLUMN IF NOT EXISTS "codes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "care_measures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL REFERENCES "businesses"("id") ON DELETE cascade,
	"episode_id" uuid NOT NULL REFERENCES "care_episodes"("id") ON DELETE cascade,
	"measure_key" text NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL,
	"unit" text,
	"side" text,
	"measured_on" date NOT NULL,
	"author_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
	"author_name" text DEFAULT '' NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "care_measures_episode_idx" ON "care_measures" USING btree ("episode_id","measured_on");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "care_inbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL REFERENCES "businesses"("id") ON DELETE cascade,
	"source" text DEFAULT 'upload' NOT NULL,
	"message_type" text DEFAULT 'document' NOT NULL,
	"title" text NOT NULL,
	"sender_name" text,
	"sender_inami" text,
	"doc_date" date,
	"patient_name" text,
	"patient_birth_date" date,
	"patient_niss_enc" text,
	"patient_niss_hash" text,
	"content_enc" text,
	"file_path" text,
	"file_name" text,
	"file_size" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"customer_id" uuid REFERENCES "customers"("id") ON DELETE set null,
	"handled_by_name" text,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "care_inbox_business_idx" ON "care_inbox" USING btree ("business_id","status","created_at");
