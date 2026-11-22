ALTER TABLE "support_threads" ADD COLUMN IF NOT EXISTS "user_typing_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_threads" ADD COLUMN IF NOT EXISTS "admin_typing_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_threads" ADD COLUMN IF NOT EXISTS "user_read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_threads" ADD COLUMN IF NOT EXISTS "admin_read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_threads" ADD COLUMN IF NOT EXISTS "closed_by" text;--> statement-breakpoint
ALTER TABLE "support_messages" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'message' NOT NULL;--> statement-breakpoint
ALTER TABLE "support_messages" ADD COLUMN IF NOT EXISTS "image_ref" text;
