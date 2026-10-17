CREATE TABLE "processed_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"kind" text NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "processed_payments" ADD CONSTRAINT "processed_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;