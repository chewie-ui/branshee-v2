CREATE TABLE "review_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"customer_id" uuid,
	"appointment_id" uuid,
	"channel" text NOT NULL,
	"email" text,
	"name" text,
	"token" text NOT NULL,
	"sent_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"google_clicked_at" timestamp with time zone,
	"feedback_rating" integer,
	"feedback" text,
	"feedback_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_settings" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"google_url" text,
	"auto_send" boolean DEFAULT false NOT NULL,
	"delay_hours" integer DEFAULT 2 NOT NULL,
	"min_days_between" integer DEFAULT 180 NOT NULL,
	"message" text,
	"qr_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_settings" ADD CONSTRAINT "review_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "review_requests_token_uq" ON "review_requests" USING btree ("token");--> statement-breakpoint
CREATE INDEX "review_requests_business_idx" ON "review_requests" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "review_requests_appointment_uq" ON "review_requests" USING btree ("appointment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_settings_qr_uq" ON "review_settings" USING btree ("qr_token");