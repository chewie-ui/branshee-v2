CREATE TABLE "pos_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"session_id" uuid,
	"year" integer NOT NULL,
	"seq" integer NOT NULL,
	"number" text NOT NULL,
	"lines" jsonb NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"vat_cents" integer NOT NULL,
	"method" text NOT NULL,
	"cash_given_cents" integer,
	"customer_id" uuid,
	"member_id" uuid,
	"status" text DEFAULT 'paid' NOT NULL,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"opened_by_id" uuid,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opening_cash_cents" integer DEFAULT 0 NOT NULL,
	"closed_by_id" uuid,
	"closed_at" timestamp with time zone,
	"counted_cash_cents" integer,
	"expected_cash_cents" integer,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"barcode" text,
	"category" text,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"vat_rate" integer DEFAULT 21 NOT NULL,
	"cost_cents" integer,
	"track_stock" boolean DEFAULT true NOT NULL,
	"stock_qty" integer DEFAULT 0 NOT NULL,
	"min_qty" integer,
	"supplier" text,
	"photo_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"low_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"member_id" uuid,
	"sale_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_session_id_pos_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."pos_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_opened_by_id_members_id_fk" FOREIGN KEY ("opened_by_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_closed_by_id_members_id_fk" FOREIGN KEY ("closed_by_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pos_sales_number_uq" ON "pos_sales" USING btree ("business_id","year","seq");--> statement-breakpoint
CREATE INDEX "pos_sales_business_idx" ON "pos_sales" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "pos_sales_session_idx" ON "pos_sales" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "pos_sessions_business_idx" ON "pos_sessions" USING btree ("business_id","opened_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pos_sessions_one_open_uq" ON "pos_sessions" USING btree ("business_id") WHERE "pos_sessions"."closed_at" is null;--> statement-breakpoint
CREATE INDEX "products_business_idx" ON "products" USING btree ("business_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "products_business_barcode_uq" ON "products" USING btree ("business_id","barcode") WHERE "products"."barcode" is not null;--> statement-breakpoint
CREATE INDEX "stock_moves_business_idx" ON "stock_moves" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_moves_product_idx" ON "stock_moves" USING btree ("product_id","created_at");