ALTER TABLE "businesses" ADD COLUMN "maps_url" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "languages" text[] DEFAULT '{}' NOT NULL;