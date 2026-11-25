-- MMS Forward-only Migration: 0186_workshop_certificates.sql
-- Phase 11, W3 — workshop completion criteria, participation certificates and Setup defaults:
--   • workshop_events.min_attendance_pct / min_score_pct (0–100, NULL = criterion not used)
--   • workshop_participants.completed_at / certificate_issued_at
--   • workshop_module_preferences: typed per-workspace defaults for new workshops (FORCE RLS)
-- All tables are small, so plain DDL is instant.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

ALTER TABLE "workshop_events"
  ADD COLUMN IF NOT EXISTS "min_attendance_pct" numeric(5, 2),
  ADD COLUMN IF NOT EXISTS "min_score_pct" numeric(5, 2);
--> statement-breakpoint
ALTER TABLE "workshop_events" DROP CONSTRAINT IF EXISTS "workshop_events_criteria_check";
--> statement-breakpoint
ALTER TABLE "workshop_events" ADD CONSTRAINT "workshop_events_criteria_check"
  CHECK (
    ("min_attendance_pct" IS NULL OR "min_attendance_pct" BETWEEN 0 AND 100)
    AND ("min_score_pct" IS NULL OR "min_score_pct" BETWEEN 0 AND 100)
  );
--> statement-breakpoint

ALTER TABLE "workshop_participants"
  ADD COLUMN IF NOT EXISTS "completed_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "certificate_issued_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "workshop_participants" DROP CONSTRAINT IF EXISTS "workshop_participants_certificate_check";
--> statement-breakpoint
ALTER TABLE "workshop_participants" ADD CONSTRAINT "workshop_participants_certificate_check"
  CHECK ("certificate_issued_at" IS NULL OR "completed_at" IS NOT NULL);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "workshop_module_preferences" (
  "workspace_subdomain"         text PRIMARY KEY NOT NULL
    REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE,
  "default_min_attendance_pct"  numeric(5, 2),
  "default_min_score_pct"       numeric(5, 2),
  "updated_at"                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "workshop_module_preferences_range_check" CHECK (
    ("default_min_attendance_pct" IS NULL OR "default_min_attendance_pct" BETWEEN 0 AND 100)
    AND ("default_min_score_pct" IS NULL OR "default_min_score_pct" BETWEEN 0 AND 100)
  )
);
--> statement-breakpoint
ALTER TABLE "workshop_module_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workshop_module_preferences" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "workshop_module_preferences";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "workshop_module_preferences"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  );
--> statement-breakpoint
DROP TRIGGER IF EXISTS "update_workshop_module_preferences_updated_at" ON "workshop_module_preferences";
--> statement-breakpoint
CREATE TRIGGER "update_workshop_module_preferences_updated_at" BEFORE UPDATE ON "workshop_module_preferences" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
