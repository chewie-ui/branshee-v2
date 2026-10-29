CREATE TABLE "error_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"source" text NOT NULL,
	"message" text NOT NULL,
	"detail" text,
	"path" text,
	"count" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"notified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"name" text PRIMARY KEY NOT NULL,
	"last_run_at" timestamp with time zone NOT NULL,
	"last_ok_at" timestamp with time zone,
	"ok" boolean NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"result" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "error_logs_fp_uq" ON "error_logs" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "error_logs_last_idx" ON "error_logs" USING btree ("last_seen_at");