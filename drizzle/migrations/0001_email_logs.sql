CREATE TABLE "email_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid,
	"appointment_id" uuid,
	"template" text NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_logs_created_idx" ON "email_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_logs_appointment_idx" ON "email_logs" USING btree ("appointment_id");