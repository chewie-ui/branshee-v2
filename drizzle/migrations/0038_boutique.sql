CREATE TABLE "shop_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"pay_method" text NOT NULL,
	"paid_at" timestamp with time zone,
	"fulfilment" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"address" text,
	"note" text,
	"lines" jsonb NOT NULL,
	"items_cents" integer NOT NULL,
	"delivery_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"token" text NOT NULL,
	"stripe_session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_settings" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"pickup" boolean DEFAULT true NOT NULL,
	"pickup_note" text,
	"delivery" boolean DEFAULT false NOT NULL,
	"delivery_cents" integer DEFAULT 0 NOT NULL,
	"free_delivery_from_cents" integer,
	"delivery_note" text,
	"pay_online" boolean DEFAULT false NOT NULL,
	"pay_on_pickup" boolean DEFAULT true NOT NULL,
	"pay_transfer" boolean DEFAULT false NOT NULL,
	"intro" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "online_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shop_orders_number_uq" ON "shop_orders" USING btree ("business_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_orders_token_uq" ON "shop_orders" USING btree ("token");--> statement-breakpoint
CREATE INDEX "shop_orders_business_idx" ON "shop_orders" USING btree ("business_id","created_at");