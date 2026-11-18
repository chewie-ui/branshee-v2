ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "ct1" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "ct2" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "language" text;--> statement-breakpoint
ALTER TABLE "care_entries" ADD COLUMN IF NOT EXISTS "confidential" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "care_entries" ADD COLUMN IF NOT EXISTS "passive" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "care_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL REFERENCES "businesses"("id") ON DELETE cascade,
	"customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE cascade,
	"role" text NOT NULL,
	"name" text NOT NULL,
	"profession" text,
	"inami" text,
	"enterprise_number" text,
	"address" text,
	"phone" text,
	"email" text,
	"iban" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "care_team_customer_idx" ON "care_team_members" USING btree ("customer_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "care_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL REFERENCES "businesses"("id") ON DELETE cascade,
	"customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE cascade,
	"episode_id" uuid REFERENCES "care_episodes"("id") ON DELETE set null,
	"doc_key" uuid NOT NULL,
	"version" integer NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"recipient_name" text,
	"recipient_inami" text,
	"content_enc" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"validated_at" timestamp with time zone,
	"author_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
	"author_name" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "care_documents_customer_idx" ON "care_documents" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "care_documents_key_version_uq" ON "care_documents" USING btree ("doc_key","version");
