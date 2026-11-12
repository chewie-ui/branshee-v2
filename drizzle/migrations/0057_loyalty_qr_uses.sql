CREATE TABLE IF NOT EXISTS "loyalty_qr_uses" (
	"sig" text PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL REFERENCES "businesses"("id") ON DELETE cascade,
	"window" integer NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_qr_uses_business_window_idx" ON "loyalty_qr_uses" ("business_id","window");