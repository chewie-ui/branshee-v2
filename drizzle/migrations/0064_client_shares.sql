CREATE TABLE IF NOT EXISTS "client_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL REFERENCES "businesses"("id") ON DELETE cascade,
	"customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE cascade,
	"kind" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body_enc" text,
	"file_ref" text,
	"file_name" text,
	"mime" text,
	"size_bytes" integer,
	"author_name" text DEFAULT '' NOT NULL,
	"seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_shares_customer_idx" ON "client_shares" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_shares_business_idx" ON "client_shares" USING btree ("business_id");
