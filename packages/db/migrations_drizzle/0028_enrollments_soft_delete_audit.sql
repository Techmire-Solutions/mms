-- Enrollments soft-delete audit columns + hot active partial index (Sessions 0027 parity).
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "deleted_by" text;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "deletion_reason" text;--> statement-breakpoint
UPDATE "enrollments"
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
UPDATE "enrollments"
SET "custom_data" = ("custom_data" - 'deletedAt' - 'deletedBy' - 'deletionReason')
WHERE "custom_data" ?| ARRAY['deletedAt', 'deletedBy', 'deletionReason'];--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enrollments_workspace_deleted_idx" ON "enrollments" USING btree ("workspace_subdomain", "deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enrollments_workspace_active_idx" ON "enrollments" USING btree ("workspace_subdomain") WHERE "deleted_at" IS NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "enrollments_workspace_subdomain_idx";
