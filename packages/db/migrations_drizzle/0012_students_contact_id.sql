-- Students typed contact_id (denormalized index column; JSONB contactId remains API SSOT).
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "contact_id" text;--> statement-breakpoint
UPDATE "students"
SET "contact_id" = NULLIF(trim("custom_data"->>'contactId'), '')
WHERE "contact_id" IS NULL
  AND NULLIF(trim("custom_data"->>'contactId'), '') IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_workspace_contact_active_idx"
  ON "students" USING btree ("workspace_subdomain", "contact_id")
  WHERE "deleted_at" IS NULL AND "contact_id" IS NOT NULL;
