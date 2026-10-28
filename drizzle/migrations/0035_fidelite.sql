CREATE TABLE "gift_card_uses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"gift_card_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"note" text,
	"member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"code" text NOT NULL,
	"initial_cents" integer NOT NULL,
	"balance_cents" integer NOT NULL,
	"buyer_name" text,
	"recipient_name" text,
	"message" text,
	"expires_on" date NOT NULL,
	"created_by_id" uuid,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"stamps" integer DEFAULT 0 NOT NULL,
	"rewards_earned" integer DEFAULT 0 NOT NULL,
	"token" text NOT NULL,
	"last_stamp_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"kind" text NOT NULL,
	"member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_settings" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"goal" integer DEFAULT 10 NOT NULL,
	"reward" text DEFAULT 'Une prestation offerte' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gift_card_uses" ADD CONSTRAINT "gift_card_uses_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_uses" ADD CONSTRAINT "gift_card_uses_gift_card_id_gift_cards_id_fk" FOREIGN KEY ("gift_card_id") REFERENCES "public"."gift_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_uses" ADD CONSTRAINT "gift_card_uses_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_created_by_id_members_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_cards" ADD CONSTRAINT "loyalty_cards_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_cards" ADD CONSTRAINT "loyalty_cards_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_moves" ADD CONSTRAINT "loyalty_moves_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_moves" ADD CONSTRAINT "loyalty_moves_card_id_loyalty_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."loyalty_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_moves" ADD CONSTRAINT "loyalty_moves_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_settings" ADD CONSTRAINT "loyalty_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gift_card_uses_card_idx" ON "gift_card_uses" USING btree ("gift_card_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gift_cards_code_uq" ON "gift_cards" USING btree ("business_id","code");--> statement-breakpoint
CREATE INDEX "gift_cards_business_idx" ON "gift_cards" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_cards_customer_uq" ON "loyalty_cards" USING btree ("business_id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_cards_token_uq" ON "loyalty_cards" USING btree ("token");--> statement-breakpoint
CREATE INDEX "loyalty_moves_card_idx" ON "loyalty_moves" USING btree ("card_id","created_at");