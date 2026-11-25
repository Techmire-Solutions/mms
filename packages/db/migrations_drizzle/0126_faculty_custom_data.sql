ALTER TABLE "faculty"
  ADD COLUMN IF NOT EXISTS "custom_data" jsonb NOT NULL DEFAULT '{}'::jsonb;
