-- Promote message_logs soft-archive from JSONB deletedAt to typed deleted_at.
ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;--> statement-breakpoint
UPDATE "message_logs"
SET "deleted_at" = COALESCE(
  "deleted_at",
  CASE
    WHEN NULLIF(trim("custom_data"->>'deletedAt'), '') IS NOT NULL
      THEN ("custom_data"->>'deletedAt')::timestamp
    ELSE NULL
  END
)
WHERE "custom_data" ? 'deletedAt';--> statement-breakpoint
UPDATE "message_logs"
SET "custom_data" = ("custom_data" - 'deletedAt')
WHERE "custom_data" ? 'deletedAt';--> statement-breakpoint
DROP INDEX IF EXISTS "message_logs_workspace_active_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "message_logs_workspace_sent_at_active_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_logs_workspace_active_idx"
  ON "message_logs" USING btree ("workspace_subdomain")
  WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_logs_workspace_sent_at_active_idx"
  ON "message_logs" USING btree ("workspace_subdomain", ((custom_data->>'sentAt')) DESC NULLS LAST)
  WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_logs_workspace_deleted_idx"
  ON "message_logs" USING btree ("workspace_subdomain", "deleted_at");
