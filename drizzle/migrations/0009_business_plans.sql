CREATE TABLE "business_plans" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"interval" "billing_interval",
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"stripe_subscription_id" text,
	"period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"granted_until" timestamp with time zone,
	"extra_seats" integer DEFAULT 0 NOT NULL,
	"custom_url_addon" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_plans_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referral_paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "business_plans" ADD CONSTRAINT "business_plans_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;