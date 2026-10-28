ALTER TABLE "pos_sales" ADD COLUMN "refund_session_id" uuid;--> statement-breakpoint
ALTER TABLE "pos_sessions" ADD COLUMN "totals" jsonb;