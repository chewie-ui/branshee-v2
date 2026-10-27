CREATE TYPE "public"."sales_doc_status" AS ENUM('draft', 'sent', 'paid', 'cancelled', 'accepted', 'refused', 'invoiced');--> statement-breakpoint
CREATE TYPE "public"."sales_doc_type" AS ENUM('invoice', 'credit', 'quote');--> statement-breakpoint
CREATE TYPE "public"."vat_regime" AS ENUM('franchise', 'assujetti');--> statement-breakpoint
CREATE TABLE "invoice_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text DEFAULT 'forfait' NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"vat_rate" integer DEFAULT 21 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_settings" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"legal_name" text DEFAULT '' NOT NULL,
	"trade_name" text DEFAULT '' NOT NULL,
	"legal_form" text DEFAULT 'Personne physique' NOT NULL,
	"street" text DEFAULT '' NOT NULL,
	"zip" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"country" text DEFAULT 'Belgique' NOT NULL,
	"bce" text DEFAULT '' NOT NULL,
	"vat_number" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"iban" text DEFAULT '' NOT NULL,
	"bic" text DEFAULT '' NOT NULL,
	"vat_regime" "vat_regime" DEFAULT 'franchise' NOT NULL,
	"payment_days" integer DEFAULT 15 NOT NULL,
	"prefix" text DEFAULT '' NOT NULL,
	"default_notes" text DEFAULT 'Merci pour votre confiance.' NOT NULL,
	"footer_note" text DEFAULT '' NOT NULL,
	"color" text DEFAULT '#4f46e5' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"doc_type" "sales_doc_type" NOT NULL,
	"status" "sales_doc_status" DEFAULT 'draft' NOT NULL,
	"year" integer,
	"seq" integer,
	"number" text,
	"customer_id" uuid,
	"client" jsonb,
	"seller" jsonb,
	"issue_date" date NOT NULL,
	"service_date" date,
	"due_date" date,
	"valid_until" date,
	"comm" text,
	"notes" text DEFAULT '' NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ht_cents" integer DEFAULT 0 NOT NULL,
	"vat_cents" integer DEFAULT 0 NOT NULL,
	"ttc_cents" integer DEFAULT 0 NOT NULL,
	"related_id" uuid,
	"appointment_id" uuid,
	"paid_date" date,
	"paid_method" text,
	"issued_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "company_name" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "vat_number" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "street" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "invoice_products" ADD CONSTRAINT "invoice_products_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_settings" ADD CONSTRAINT "invoice_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_products_business_idx" ON "invoice_products" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "sales_documents_business_idx" ON "sales_documents" USING btree ("business_id","doc_type","issue_date");--> statement-breakpoint
CREATE INDEX "sales_documents_customer_idx" ON "sales_documents" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_documents_number_uq" ON "sales_documents" USING btree ("business_id","doc_type","year","seq") WHERE "sales_documents"."seq" is not null;--> statement-breakpoint
-- Nouvelle permission « Factures et devis » : accordée au grade Administrateur intégré, refusée ailleurs.
UPDATE "grades" SET "permissions" = "permissions" || jsonb_build_object('invoices', jsonb_build_object('view', is_built_in AND name = 'Administrateur', 'manage', is_built_in AND name = 'Administrateur')) WHERE NOT ("permissions" ? 'invoices');
