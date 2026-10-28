CREATE TABLE "quote_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"token" text NOT NULL,
	"email" text NOT NULL,
	"doc_hash" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"viewed_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	"signer_name" text,
	"signer_ip" text,
	"signer_agent" text,
	"signature_path" text,
	"declined_at" timestamp with time zone,
	"decline_reason" text,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "quote_signatures" ADD CONSTRAINT "quote_signatures_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_signatures" ADD CONSTRAINT "quote_signatures_document_id_sales_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."sales_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quote_signatures_token_uq" ON "quote_signatures" USING btree ("token");--> statement-breakpoint
CREATE INDEX "quote_signatures_doc_idx" ON "quote_signatures" USING btree ("document_id");