-- MMS Forward-only Migration: 0205_dashboard_schema_hardening.sql
-- 1. Align updated_at columns with Drizzle schema (timestamptz / timestamp with time zone).
-- 2. Add update_updated_at_column triggers to dashboard_preferences and dashboard_widgets.
-- 3. Add soft-delete sextuple columns to dashboard_widgets and wire forbid_hard_delete trigger.
-- 4. Replace unused/un-ordered pinned index with partial compound sort indexes.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

ALTER TABLE "dashboard_preferences" ALTER COLUMN "updated_at" TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint

ALTER TABLE "dashboard_widgets" ALTER COLUMN "updated_at" TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_dashboard_preferences_updated_at ON "dashboard_preferences";
--> statement-breakpoint
CREATE TRIGGER trg_dashboard_preferences_updated_at
  BEFORE UPDATE ON "dashboard_preferences"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_dashboard_widgets_updated_at ON "dashboard_widgets";
--> statement-breakpoint
CREATE TRIGGER trg_dashboard_widgets_updated_at
  BEFORE UPDATE ON "dashboard_widgets"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint

ALTER TABLE "dashboard_widgets" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "dashboard_widgets" ADD COLUMN IF NOT EXISTS "deleted_by" text;
--> statement-breakpoint
ALTER TABLE "dashboard_widgets" ADD COLUMN IF NOT EXISTS "deletion_reason" varchar(500);
--> statement-breakpoint
ALTER TABLE "dashboard_widgets" ADD COLUMN IF NOT EXISTS "restored_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "dashboard_widgets" ADD COLUMN IF NOT EXISTS "restored_by" text;
--> statement-breakpoint
ALTER TABLE "dashboard_widgets" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" boolean DEFAULT false;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_dashboard_widgets_forbid_hard_delete ON "dashboard_widgets";
--> statement-breakpoint
CREATE TRIGGER trg_dashboard_widgets_forbid_hard_delete
  BEFORE DELETE ON "dashboard_widgets"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint

DROP INDEX IF EXISTS "dashboard_widgets_workspace_pinned_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dashboard_widgets_workspace_pinned_sort_idx"
  ON "dashboard_widgets" ("workspace_subdomain", "sort_order", "id")
  WHERE "deleted_at" IS NULL AND "is_pinned_to_dashboard" = true;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dashboard_widgets_workspace_active_sort_idx"
  ON "dashboard_widgets" ("workspace_subdomain", "sort_order", "id")
  WHERE "deleted_at" IS NULL;

