-- Null orphan contact_id values, then add composite FK (tenant_users parity).
-- Soft-deleted contacts keep their rows — FK remains valid.

UPDATE "students" AS s
SET "contact_id" = NULL
WHERE s."contact_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "contacts" AS c
    WHERE c."workspace_subdomain" = s."workspace_subdomain"
      AND c."id" = s."contact_id"
  );--> statement-breakpoint

ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "students_workspace_subdomain_contact_id_contacts_workspace_subdomain_id_fk";--> statement-breakpoint

ALTER TABLE "students" ADD CONSTRAINT "students_workspace_subdomain_contact_id_contacts_workspace_subdomain_id_fk"
  FOREIGN KEY ("workspace_subdomain", "contact_id")
  REFERENCES "public"."contacts"("workspace_subdomain", "id")
  ON DELETE set null
  ON UPDATE no action;
