CREATE TABLE "interventions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"customer_id" uuid,
	"client_name" text NOT NULL,
	"client_phone" text,
	"client_email" text,
	"address" text,
	"title" text NOT NULL,
	"description" text,
	"technician_id" uuid,
	"scheduled_at" timestamp with time zone,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"report" text,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"labor_minutes" integer,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"signer_name" text,
	"signature_path" text,
	"signed_at" timestamp with time zone,
	"invoice_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_technician_id_members_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interventions_business_idx" ON "interventions" USING btree ("business_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "interventions_tech_idx" ON "interventions" USING btree ("technician_id","scheduled_at");