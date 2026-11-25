-- Teachers typed contact_id (denormalized index column; JSONB contactId remains API SSOT until strip).
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "contact_id" text;--> statement-breakpoint
UPDATE "teachers"
SET "contact_id" = NULLIF(trim("custom_data"->>'contactId'), '')
WHERE "contact_id" IS NULL
  AND NULLIF(trim("custom_data"->>'contactId'), '') IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teachers_workspace_contact_active_idx"
  ON "teachers" USING btree ("workspace_subdomain", "contact_id")
  WHERE "deleted_at" IS NULL AND "contact_id" IS NOT NULL;--> statement-breakpoint

-- Null orphan contact_id values, then add composite FK.
UPDATE "teachers" AS t
SET "contact_id" = NULL
WHERE t."contact_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "contacts" AS c
    WHERE c."workspace_subdomain" = t."workspace_subdomain"
      AND c."id" = t."contact_id"
  );--> statement-breakpoint

ALTER TABLE "teachers" DROP CONSTRAINT IF EXISTS "teachers_workspace_subdomain_contact_id_contacts_workspace_subdomain_id_fk";--> statement-breakpoint

ALTER TABLE "teachers" ADD CONSTRAINT "teachers_workspace_subdomain_contact_id_contacts_workspace_subdomain_id_fk"
  FOREIGN KEY ("workspace_subdomain", "contact_id")
  REFERENCES "public"."contacts"("workspace_subdomain", "id")
  ON DELETE set null
  ON UPDATE no action;
