ALTER TABLE "appointments" ADD COLUMN "locale" text DEFAULT 'fr' NOT NULL;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD COLUMN "locale" text DEFAULT 'fr' NOT NULL;