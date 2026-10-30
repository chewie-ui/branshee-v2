CREATE TABLE "prospect_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"prospect_id" uuid NOT NULL,
	"member_id" uuid,
	"outcome" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospect_scripts" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"company" text,
	"phone" text,
	"email" text,
	"city" text,
	"trade" text,
	"note" text,
	"status" text DEFAULT 'todo' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_call_at" timestamp with time zone,
	"callback_at" timestamp with time zone,
	"refuse_reason" text,
	"deal_id" uuid,
	"owner_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prospect_calls" ADD CONSTRAINT "prospect_calls_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_calls" ADD CONSTRAINT "prospect_calls_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_calls" ADD CONSTRAINT "prospect_calls_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_scripts" ADD CONSTRAINT "prospect_scripts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_owner_member_id_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prospect_calls_business_idx" ON "prospect_calls" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "prospect_calls_prospect_idx" ON "prospect_calls" USING btree ("prospect_id","created_at");--> statement-breakpoint
CREATE INDEX "prospects_business_status_idx" ON "prospects" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "prospects_business_callback_idx" ON "prospects" USING btree ("business_id","callback_at");