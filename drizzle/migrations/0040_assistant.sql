CREATE TABLE "assistant_settings" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"enabled_at" timestamp with time zone,
	"enabled_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "assistant_usage" (
	"business_id" uuid NOT NULL,
	"day" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "assistant_usage_business_id_day_pk" PRIMARY KEY("business_id","day")
);
--> statement-breakpoint
ALTER TABLE "assistant_settings" ADD CONSTRAINT "assistant_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_settings" ADD CONSTRAINT "assistant_settings_enabled_by_id_users_id_fk" FOREIGN KEY ("enabled_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_usage" ADD CONSTRAINT "assistant_usage_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;