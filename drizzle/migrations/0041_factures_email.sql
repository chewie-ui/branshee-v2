CREATE TABLE "invoice_mailings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"token" text NOT NULL,
	"email" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"viewed_at" timestamp with time zone,
	"reminders_sent" integer DEFAULT 0 NOT NULL,
	"last_reminder_at" timestamp with time zone,
	"reminders_off" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_reminder_settings" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"first_days" integer DEFAULT 3 NOT NULL,
	"every_days" integer DEFAULT 7 NOT NULL,
	"max_reminders" integer DEFAULT 3 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice_mailings" ADD CONSTRAINT "invoice_mailings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_mailings" ADD CONSTRAINT "invoice_mailings_document_id_sales_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."sales_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_reminder_settings" ADD CONSTRAINT "invoice_reminder_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_mailings_doc_uq" ON "invoice_mailings" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_mailings_token_uq" ON "invoice_mailings" USING btree ("token");--> statement-breakpoint
CREATE INDEX "invoice_mailings_business_idx" ON "invoice_mailings" USING btree ("business_id");