CREATE TABLE "service_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	CONSTRAINT "service_hours_weekday_ck" CHECK ("service_hours"."weekday" between 0 and 6),
	CONSTRAINT "service_hours_order_ck" CHECK ("service_hours"."start_time" < "service_hours"."end_time")
);
--> statement-breakpoint
ALTER TABLE "service_hours" ADD CONSTRAINT "service_hours_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_hours_service_idx" ON "service_hours" USING btree ("service_id");