DROP INDEX "group_sessions_service_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "group_sessions_service_start_uq" ON "group_sessions" USING btree ("service_id","starts_at");