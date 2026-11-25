-- Contacts soft-delete audit columns + drop redundant workspace-only index.
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "deleted_by" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "deletion_reason" text;--> statement-breakpoint
-- Best-effort backfill from any residual JSONB keys (including orphan audit without deleted_at).
UPDATE "contacts"
SET
  "deleted_by" = COALESCE("deleted_by", NULLIF(trim("custom_data"->>'deletedBy'), '')),
  "deletion_reason" = COALESCE("deletion_reason", NULLIF(trim("custom_data"->>'deletionReason'), '')),
  "deleted_at" = COALESCE(
    "deleted_at",
    CASE
      WHEN NULLIF(trim("custom_data"->>'deletedAt'), '') IS NOT NULL
        THEN ("custom_data"->>'deletedAt')::timestamp
      WHEN NULLIF(trim("custom_data"->>'deletedBy'), '') IS NOT NULL
        OR NULLIF(trim("custom_data"->>'deletionReason'), '') IS NOT NULL
        THEN now()
      ELSE NULL
    END
  )
WHERE "custom_data" ?| ARRAY['deletedAt', 'deletedBy', 'deletionReason'];--> statement-breakpoint
UPDATE "contacts"
SET "custom_data" = ("custom_data" - 'deletedAt' - 'deletedBy' - 'deletionReason')
WHERE "custom_data" ?| ARRAY['deletedAt', 'deletedBy', 'deletionReason'];--> statement-breakpoint
DROP INDEX IF EXISTS "contacts_workspace_subdomain_idx";
