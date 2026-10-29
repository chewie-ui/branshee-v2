ALTER TABLE "loyalty_moves" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "loyalty_moves" ADD COLUMN "ref" text;--> statement-breakpoint
ALTER TABLE "loyalty_settings" ADD COLUMN "auto_appointment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "loyalty_settings" ADD COLUMN "auto_shop" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "loyalty_settings" ADD COLUMN "qr_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_moves_ref_uq" ON "loyalty_moves" USING btree ("business_id","ref") WHERE "loyalty_moves"."ref" is not null;