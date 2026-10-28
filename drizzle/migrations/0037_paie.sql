CREATE TABLE "payroll_closures" (
	"business_id" uuid NOT NULL,
	"month" text NOT NULL,
	"closed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_by_id" uuid,
	CONSTRAINT "payroll_closures_business_id_month_pk" PRIMARY KEY("business_id","month")
);
--> statement-breakpoint
CREATE TABLE "payroll_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"month" text NOT NULL,
	"adjust_minutes" integer DEFAULT 0 NOT NULL,
	"bonus_cents" integer DEFAULT 0 NOT NULL,
	"km" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_profiles" (
	"member_id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"weekly_minutes" integer DEFAULT 2280 NOT NULL,
	"pay_type" text DEFAULT 'hourly' NOT NULL,
	"rate_cents" integer DEFAULT 0 NOT NULL,
	"meal_vouchers" boolean DEFAULT false NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payroll_closures" ADD CONSTRAINT "payroll_closures_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_closures" ADD CONSTRAINT "payroll_closures_closed_by_id_users_id_fk" FOREIGN KEY ("closed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_profiles" ADD CONSTRAINT "payroll_profiles_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_profiles" ADD CONSTRAINT "payroll_profiles_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_entries_uq" ON "payroll_entries" USING btree ("business_id","member_id","month");