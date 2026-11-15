ALTER TABLE "loyalty_settings" ADD COLUMN IF NOT EXISTS "theme" jsonb DEFAULT '{}'::jsonb NOT NULL;
