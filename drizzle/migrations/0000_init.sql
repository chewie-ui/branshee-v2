CREATE TYPE "public"."locale" AS ENUM('fr', 'en', 'nl', 'de', 'es', 'it');--> statement-breakpoint
CREATE TYPE "public"."login_method" AS ENUM('password', 'two_factor', 'google', 'apple');--> statement-breakpoint
CREATE TYPE "public"."cancellation_rule" AS ENUM('free', 'half_24h', 'full_12h');--> statement-breakpoint
CREATE TYPE "public"."location_mode" AS ENUM('on_site', 'online', 'embed');--> statement-breakpoint
CREATE TYPE "public"."schedule_mode" AS ENUM('shared', 'per_member');--> statement-breakpoint
CREATE TYPE "public"."slot_mode" AS ENUM('fixed', 'interval');--> statement-breakpoint
CREATE TYPE "public"."stripe_connect_status" AS ENUM('not_connected', 'pending', 'active');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('invited', 'requested', 'active', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."audience" AS ENUM('all', 'new', 'existing');--> statement-breakpoint
CREATE TYPE "public"."fee_type" AS ENUM('percent', 'amount');--> statement-breakpoint
CREATE TYPE "public"."form_question_type" AS ENUM('text', 'choice', 'yes_no');--> statement-breakpoint
CREATE TYPE "public"."service_kind" AS ENUM('individual', 'group');--> statement-breakpoint
CREATE TYPE "public"."appointment_kind" AS ENUM('appointment', 'block');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('pending', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."no_show_reason" AS ENUM('justified', 'unjustified');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('online', 'on_site', 'bank_transfer', 'paypal', 'cash', 'none');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('none', 'authorized', 'paid', 'refunded', 'partial', 'penalty', 'failed');--> statement-breakpoint
CREATE TYPE "public"."billing_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'pro', 'pro_plus');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'trialing', 'past_due', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "google_calendar_connections" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"google_email" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"access_token_enc" text,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"method" "login_method" NOT NULL,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" text DEFAULT 'unknown' NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"ip" text,
	"impersonated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"full_name" text NOT NULL,
	"password_hash" text,
	"google_id" text,
	"apple_id" text,
	"avatar_url" text,
	"phone" text,
	"locale" "locale" DEFAULT 'fr' NOT NULL,
	"birth_date" date,
	"gender" text,
	"address" text,
	"postal_code" text,
	"city" text,
	"country" text,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"two_factor_secret" text,
	"session_version" integer DEFAULT 0 NOT NULL,
	"is_superadmin" boolean DEFAULT false NOT NULL,
	"disabled_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"referral_code" text,
	"referred_by_id" uuid,
	"acquisition" jsonb,
	"legacy_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id"),
	CONSTRAINT "users_apple_id_unique" UNIQUE("apple_id"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code"),
	CONSTRAINT "users_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "verification_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"purpose" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid,
	"actor_name" text NOT NULL,
	"action" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_page_settings" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"theme" jsonb DEFAULT '{"accentColor":"#4f46e5","accentText":"#ffffff","pageBg":"#f7f7f8","font":"Inter","radius":"md","layout":"classic"}'::jsonb NOT NULL,
	"sections" jsonb DEFAULT '["about","services","location","hours"]'::jsonb NOT NULL,
	"show_contact" jsonb DEFAULT '{"email":true,"phone":true,"instagram":true,"facebook":true,"whatsapp":true,"website":true}'::jsonb NOT NULL,
	"gallery" text[] DEFAULT '{}' NOT NULL,
	"gallery_layout" text DEFAULT 'grid' NOT NULL,
	"equipment" text[] DEFAULT '{}' NOT NULL,
	"amenities" jsonb DEFAULT '{"cleanliness":[],"comfort":[],"practical":[]}'::jsonb NOT NULL,
	"faq" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"badges" text[] DEFAULT '{}' NOT NULL,
	"category_style" text DEFAULT 'pills' NOT NULL,
	"embed" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_settings" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"schedule_mode" "schedule_mode" DEFAULT 'shared' NOT NULL,
	"slot_mode" "slot_mode" DEFAULT 'fixed' NOT NULL,
	"slot_interval_min" integer DEFAULT 30 NOT NULL,
	"buffer_before_min" integer DEFAULT 0 NOT NULL,
	"buffer_after_min" integer DEFAULT 0 NOT NULL,
	"min_lead_min" integer,
	"horizon_days" integer,
	"auto_confirm" boolean DEFAULT true NOT NULL,
	"waitlist_enabled" boolean DEFAULT false NOT NULL,
	"allow_overbooking" boolean DEFAULT false NOT NULL,
	"phone_required" boolean DEFAULT true NOT NULL,
	"smart_grouping" jsonb DEFAULT '{"enabled":false,"windowHours":3,"weekdays":[]}'::jsonb NOT NULL,
	"first_visit_question" jsonb DEFAULT '{"enabled":false,"question":"Est-ce la première fois que vous nous consultez ?","newLabel":"Oui, je suis nouveau","existingLabel":"Non, j’ai déjà consulté"}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"business_type" text,
	"photo_url" text,
	"description" text,
	"about_html" text,
	"email" text,
	"phone" text,
	"website" text,
	"social" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"location_mode" "location_mode" DEFAULT 'on_site' NOT NULL,
	"address" text,
	"postal_code" text,
	"city" text,
	"country" text,
	"latitude" double precision,
	"longitude" double precision,
	"map_embed_url" text,
	"timezone" text DEFAULT 'Europe/Brussels' NOT NULL,
	"paused_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"boost_position" integer DEFAULT 0 NOT NULL,
	"legacy_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_slug_unique" UNIQUE("slug"),
	CONSTRAINT "businesses_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"reminder_delay_hours" integer DEFAULT 24 NOT NULL,
	"reminder_message" text,
	"confirmation_message" text,
	"cancellation_message" text,
	"reminder_payment_methods" text[] DEFAULT '{}' NOT NULL,
	"reminder_payment_note" text,
	"email_owner_on_new_booking" boolean DEFAULT true NOT NULL,
	"email_owner_on_cancellation" boolean DEFAULT true NOT NULL,
	"sms_reminders" boolean DEFAULT false NOT NULL,
	"sms_confirmations" boolean DEFAULT false NOT NULL,
	"sms_allow_overage" boolean DEFAULT false NOT NULL,
	"whatsapp_reminders" boolean DEFAULT false NOT NULL,
	"whatsapp_confirmations" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_settings" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"prepayment_enabled" boolean DEFAULT false NOT NULL,
	"prepayment_required" boolean DEFAULT false NOT NULL,
	"cancellation_rule" "cancellation_rule" DEFAULT 'free' NOT NULL,
	"stripe_account_id" text,
	"stripe_status" "stripe_connect_status" DEFAULT 'not_connected' NOT NULL,
	"stripe_account_email" text,
	"accepted" jsonb DEFAULT '{"cash":false,"cardOnSite":false,"bankTransfer":{"enabled":false},"paypal":{"enabled":false},"qrCode":{"enabled":false}}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_built_in" boolean DEFAULT false NOT NULL,
	"permissions" jsonb NOT NULL,
	"legacy_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grades_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid,
	"is_owner" boolean DEFAULT false NOT NULL,
	"status" "member_status" DEFAULT 'invited' NOT NULL,
	"grade_id" uuid,
	"can_manage_own_time_off" boolean,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_bookable" boolean DEFAULT true NOT NULL,
	"display_name" text NOT NULL,
	"photo_url" text,
	"bio" text,
	"role_label" text,
	"show_role" boolean DEFAULT false NOT NULL,
	"custom_info" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"calendar_color" text,
	"calendar_feed_token" text,
	"joined_at" timestamp with time zone,
	"legacy_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_calendar_feed_token_unique" UNIQUE("calendar_feed_token"),
	CONSTRAINT "members_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "schedule_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"member_id" uuid,
	"date" date NOT NULL,
	"is_closed" boolean DEFAULT true NOT NULL,
	"hours" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"member_id" uuid,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_hours_weekday_ck" CHECK ("weekly_hours"."weekday" between 0 and 6),
	CONSTRAINT "weekly_hours_order_ck" CHECK ("weekly_hours"."start_time" < "weekly_hours"."end_time")
);
--> statement-breakpoint
CREATE TABLE "form_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"label" text NOT NULL,
	"type" "form_question_type" DEFAULT 'text' NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"options" text[] DEFAULT '{}' NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"member_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"capacity" integer,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intake_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"label" text NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intake_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"question" text NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_intake_rules" (
	"service_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	CONSTRAINT "service_intake_rules_service_id_option_id_pk" PRIMARY KEY("service_id","option_id")
);
--> statement-breakpoint
CREATE TABLE "service_members" (
	"service_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	CONSTRAINT "service_members_service_id_member_id_pk" PRIMARY KEY("service_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"category_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer,
	"duration_min" integer DEFAULT 30 NOT NULL,
	"duration_max_min" integer,
	"kind" "service_kind" DEFAULT 'individual' NOT NULL,
	"capacity" integer,
	"color" text,
	"image_url" text,
	"location" text,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"audience" "audience" DEFAULT 'all' NOT NULL,
	"cancellation_fee_type" "fee_type",
	"cancellation_fee_value" integer,
	"recurrence" jsonb,
	"blocks_individual" boolean DEFAULT true NOT NULL,
	"legacy_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_legacy_id_unique" UNIQUE("legacy_id"),
	CONSTRAINT "services_duration_ck" CHECK ("services"."duration_min" > 0 and ("services"."duration_max_min" is null or "services"."duration_max_min" >= "services"."duration_min"))
);
--> statement-breakpoint
CREATE TABLE "appointment_payments" (
	"appointment_id" uuid PRIMARY KEY NOT NULL,
	"method" "payment_method" DEFAULT 'none' NOT NULL,
	"status" "payment_status" DEFAULT 'none' NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"penalty_cents" integer DEFAULT 0 NOT NULL,
	"kept_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_setup_intent_id" text,
	"stripe_customer_id" text,
	"stripe_payment_method_id" text,
	"card_brand" text,
	"card_last4" text,
	"paid_at" timestamp with time zone,
	"cancellation_decision" text,
	"cancellation_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"kind" "appointment_kind" DEFAULT 'appointment' NOT NULL,
	"status" "appointment_status" DEFAULT 'confirmed' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"member_id" uuid,
	"service_id" uuid,
	"group_session_id" uuid,
	"customer_id" uuid,
	"service_name" text,
	"service_color" text,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"customer_message" text,
	"form_answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"internal_note" text,
	"overbooked" boolean DEFAULT false NOT NULL,
	"no_show" boolean DEFAULT false NOT NULL,
	"no_show_reason" "no_show_reason",
	"manage_token" text NOT NULL,
	"reminder_sent_at" timestamp with time zone,
	"manual_reminder_sent_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"google_event_id" text,
	"created_by_id" uuid,
	"legacy_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_manage_token_unique" UNIQUE("manage_token"),
	CONSTRAINT "appointments_legacy_id_unique" UNIQUE("legacy_id"),
	CONSTRAINT "appointments_order_ck" CHECK ("appointments"."starts_at" < "appointments"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "customer_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"author_member_id" uuid,
	"date" date NOT NULL,
	"title" text,
	"note_enc" text,
	"todo_enc" text,
	"attachment_path" text,
	"attachment_name" text,
	"attachment_size" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid,
	"first_name" text,
	"last_name" text,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"alt_name" text,
	"alt_email" text,
	"alt_phone" text,
	"general_info_enc" text,
	"created_manually" boolean DEFAULT false NOT NULL,
	"blocked_at" timestamp with time zone,
	"blocked_reason" text,
	"legacy_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "review_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid,
	"business_id" uuid NOT NULL,
	"reporter_kind" text NOT NULL,
	"reporter_user_id" uuid,
	"reporter_fingerprint" text,
	"reason" text NOT NULL,
	"message" text,
	"snapshot" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid,
	"author_name" text NOT NULL,
	"author_avatar_url" text,
	"rating" integer NOT NULL,
	"comment" text,
	"legacy_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_legacy_id_unique" UNIQUE("legacy_id"),
	CONSTRAINT "reviews_rating_ck" CHECK ("reviews"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "access_link_uses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"access_link_id" uuid NOT NULL,
	"user_id" uuid,
	"email" text,
	"ip" text,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text,
	"plan" "plan" NOT NULL,
	"duration_days" integer DEFAULT 30 NOT NULL,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_links_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "business_modules" (
	"business_id" uuid NOT NULL,
	"module_key" text NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stripe_subscription_item_id" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "business_modules_business_id_module_key_pk" PRIMARY KEY("business_id","module_key")
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"stripe_price_id" text,
	"is_available" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promo_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"ends_at" timestamp with time zone,
	"first_period_cents" integer DEFAULT 100 NOT NULL,
	"days" integer DEFAULT 30 NOT NULL,
	"plan" "plan" DEFAULT 'pro' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" integer NOT NULL,
	"trial_days" integer DEFAULT 30 NOT NULL,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default_offer" boolean DEFAULT false NOT NULL,
	"applies_to" text,
	"legacy_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_codes_code_unique" UNIQUE("code"),
	CONSTRAINT "promo_codes_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "promo_redemptions" (
	"promo_code_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_redemptions_promo_code_id_user_id_pk" PRIMARY KEY("promo_code_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "referral_credits" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"months_claimed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_wallets" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"balance_cents" integer DEFAULT 0 NOT NULL,
	"auto_recharge" jsonb DEFAULT '{"enabled":false,"thresholdCents":500,"amountCents":2000}'::jsonb NOT NULL,
	"low_balance_alert" text,
	"month_key" text,
	"month_count" integer DEFAULT 0 NOT NULL,
	"last_auto_recharge_failure_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"interval" "billing_interval",
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"granted_until" timestamp with time zone,
	"extra_seats" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "admin_message_dismissals" (
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"dismissed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_message_dismissals_message_id_user_id_pk" PRIMARY KEY("message_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "admin_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"type" text DEFAULT 'info' NOT NULL,
	"cta_label" text,
	"cta_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text,
	"cover_image_url" text,
	"content_html" text DEFAULT '' NOT NULL,
	"category" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"scheduled_for" timestamp with time zone,
	"meta_title" text,
	"meta_description" text,
	"author_name" text DEFAULT 'L’équipe Branshee' NOT NULL,
	"reading_minutes" integer DEFAULT 1 NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"legacy_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_slug_unique" UNIQUE("slug"),
	CONSTRAINT "articles_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"message" text,
	"hidden_in_nav" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "help_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"videos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"faqs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_titles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"source" text DEFAULT 'request' NOT NULL,
	"requested_by_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_titles_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_id" text NOT NULL,
	"path" text NOT NULL,
	"source" text,
	"medium" text,
	"campaign" text,
	"gclid" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"slug" text,
	"custom_domain" text,
	"published_at" timestamp with time zone,
	"template" text DEFAULT '1' NOT NULL,
	"theme" jsonb DEFAULT '{"primaryColor":"#4f46e5","bgColor":"#ffffff","textColor":"#0f0f1a","fontFamily":"Inter","roundness":"soft"}'::jsonb NOT NULL,
	"seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"logo_url" text,
	"social" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"visit_count" integer DEFAULT 0 NOT NULL,
	"legacy_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sites_business_id_unique" UNIQUE("business_id"),
	CONSTRAINT "sites_slug_unique" UNIQUE("slug"),
	CONSTRAINT "sites_custom_domain_unique" UNIQUE("custom_domain"),
	CONSTRAINT "sites_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "supervision_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"requested_by_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"token_hash" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supervision_requests_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_user_id" uuid NOT NULL,
	"sender" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_threads" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"unread_by_admin" integer DEFAULT 0 NOT NULL,
	"unread_by_user" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rating" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_impersonated_by_id_users_id_fk" FOREIGN KEY ("impersonated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_page_settings" ADD CONSTRAINT "booking_page_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_settings" ADD CONSTRAINT "booking_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_settings" ADD CONSTRAINT "payment_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_hours" ADD CONSTRAINT "weekly_hours_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_hours" ADD CONSTRAINT "weekly_hours_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_questions" ADD CONSTRAINT "form_questions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_sessions" ADD CONSTRAINT "group_sessions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_sessions" ADD CONSTRAINT "group_sessions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_options" ADD CONSTRAINT "intake_options_question_id_intake_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."intake_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_questions" ADD CONSTRAINT "intake_questions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_intake_rules" ADD CONSTRAINT "service_intake_rules_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_intake_rules" ADD CONSTRAINT "service_intake_rules_option_id_intake_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."intake_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_members" ADD CONSTRAINT "service_members_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_members" ADD CONSTRAINT "service_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_payments" ADD CONSTRAINT "appointment_payments_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_group_session_id_group_sessions_id_fk" FOREIGN KEY ("group_session_id") REFERENCES "public"."group_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_author_member_id_members_id_fk" FOREIGN KEY ("author_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_link_uses" ADD CONSTRAINT "access_link_uses_access_link_id_access_links_id_fk" FOREIGN KEY ("access_link_id") REFERENCES "public"."access_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_link_uses" ADD CONSTRAINT "access_link_uses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_modules" ADD CONSTRAINT "business_modules_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_modules" ADD CONSTRAINT "business_modules_module_key_modules_key_fk" FOREIGN KEY ("module_key") REFERENCES "public"."modules"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_promo_code_id_promo_codes_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_credits" ADD CONSTRAINT "referral_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_wallets" ADD CONSTRAINT "sms_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_message_dismissals" ADD CONSTRAINT "admin_message_dismissals_message_id_admin_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."admin_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_message_dismissals" ADD CONSTRAINT "admin_message_dismissals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_messages" ADD CONSTRAINT "admin_messages_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_titles" ADD CONSTRAINT "job_titles_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervision_requests" ADD CONSTRAINT "supervision_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervision_requests" ADD CONSTRAINT "supervision_requests_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_thread_user_id_support_threads_user_id_fk" FOREIGN KEY ("thread_user_id") REFERENCES "public"."support_threads"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_threads" ADD CONSTRAINT "support_threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_events_user_idx" ON "login_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_referred_by_idx" ON "users" USING btree ("referred_by_id");--> statement-breakpoint
CREATE INDEX "verification_codes_email_idx" ON "verification_codes" USING btree ("email","purpose");--> statement-breakpoint
CREATE INDEX "activity_logs_business_idx" ON "activity_logs" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "businesses_owner_idx" ON "businesses" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "businesses_city_type_idx" ON "businesses" USING btree ("city","business_type");--> statement-breakpoint
CREATE UNIQUE INDEX "service_categories_business_name_uq" ON "service_categories" USING btree ("business_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "grades_business_name_uq" ON "grades" USING btree ("business_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "members_business_user_uq" ON "members" USING btree ("business_id","user_id");--> statement-breakpoint
CREATE INDEX "members_user_idx" ON "members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "schedule_exceptions_lookup_idx" ON "schedule_exceptions" USING btree ("business_id","date");--> statement-breakpoint
CREATE INDEX "weekly_hours_lookup_idx" ON "weekly_hours" USING btree ("business_id","member_id","weekday");--> statement-breakpoint
CREATE INDEX "form_questions_business_idx" ON "form_questions" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "group_sessions_service_idx" ON "group_sessions" USING btree ("service_id","starts_at");--> statement-breakpoint
CREATE INDEX "services_business_idx" ON "services" USING btree ("business_id","position");--> statement-breakpoint
CREATE INDEX "appointments_agenda_idx" ON "appointments" USING btree ("business_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_member_idx" ON "appointments" USING btree ("member_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_customer_idx" ON "appointments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "appointments_reminder_idx" ON "appointments" USING btree ("starts_at") WHERE "appointments"."status" = 'confirmed' and "appointments"."reminder_sent_at" is null;--> statement-breakpoint
CREATE INDEX "customer_notes_customer_idx" ON "customer_notes" USING btree ("customer_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_business_email_uq" ON "customers" USING btree ("business_id",lower("email")) WHERE "customers"."email" is not null;--> statement-breakpoint
CREATE INDEX "customers_business_name_idx" ON "customers" USING btree ("business_id","full_name");--> statement-breakpoint
CREATE INDEX "customers_user_idx" ON "customers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "review_reports_status_idx" ON "review_reports" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_business_user_uq" ON "reviews" USING btree ("business_id","user_id");--> statement-breakpoint
CREATE INDEX "access_link_uses_link_idx" ON "access_link_uses" USING btree ("access_link_id");--> statement-breakpoint
CREATE INDEX "admin_messages_recipient_idx" ON "admin_messages" USING btree ("recipient_id","created_at");--> statement-breakpoint
CREATE INDEX "articles_published_idx" ON "articles" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "page_views_created_idx" ON "page_views" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "support_messages_thread_idx" ON "support_messages" USING btree ("thread_user_id","created_at");