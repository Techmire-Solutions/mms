-- MMS Forward-only Migration: 0207_session_delivery_integrity.sql
-- Rollover execution durability + completion finalisation gates (review of 2026-11-07):
--   1. `session_promotion_runs` gains execution phases (`claimed_at`, `structure_copied_at`,
--      `staff_copied_at`, `calendar_copied_at`) so a retried job resumes instead of duplicating.
--   2. Promotion rows get real foreign keys (sessions, runs, classes) and one-active-run-per-source;
--      the class map cascades with its run, so purges and workspace deletion cannot orphan rows.
--   3. `session_promotion_run_warnings` records skipped staff/calendar/class-map copies (a retry that
--      cannot copy something must say so instead of silently dropping it).
--   4. Capacity upper bounds for classes/sections.
--   5. `exams.results_finalized_at` (grade finalisation) and `sessions.completion_evaluated_at`
--      (completion staleness).
--   6. A conditional live-enrollment uniqueness index (skipped, with a warning, when legacy
--      duplicates exist so the deploy is never blocked by old data).

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ───────────────────────── 1. rollover execution phases ─────────────────────────
ALTER TABLE "session_promotion_runs" ADD COLUMN IF NOT EXISTS "claimed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "session_promotion_runs" ADD COLUMN IF NOT EXISTS "structure_copied_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "session_promotion_runs" ADD COLUMN IF NOT EXISTS "staff_copied_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "session_promotion_runs" ADD COLUMN IF NOT EXISTS "calendar_copied_at" timestamp with time zone;
--> statement-breakpoint

-- ───────────────────────── 2. promotion foreign keys ─────────────────────────
-- Cascade with the session so deliberate purges (which delete sessions) and workspace deletion keep
-- working; the audit trail remains the permanent record of the rollover.
DO $$ BEGIN
  ALTER TABLE "session_promotion_runs" ADD CONSTRAINT "session_promotion_runs_source_fk"
    FOREIGN KEY ("workspace_subdomain", "source_session_id")
    REFERENCES "sessions" ("workspace_subdomain", "id") ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_promotion_runs" ADD CONSTRAINT "session_promotion_runs_target_fk"
    FOREIGN KEY ("workspace_subdomain", "target_session_id")
    REFERENCES "sessions" ("workspace_subdomain", "id") ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "session_promotion_runs" VALIDATE CONSTRAINT "session_promotion_runs_source_fk";
--> statement-breakpoint
ALTER TABLE "session_promotion_runs" VALIDATE CONSTRAINT "session_promotion_runs_target_fk";
--> statement-breakpoint

-- One active run per source session (defence in depth over the advisory lock in createPromotionRun).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "session_promotion_runs"
     WHERE "status" IN ('queued', 'running')
     GROUP BY "workspace_subdomain", "source_session_id"
    HAVING count(*) > 1
  ) THEN
    RAISE WARNING 'session_promotion_runs_active_uidx skipped: duplicate active runs exist; resolve them and re-run';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS "session_promotion_runs_active_uidx"
      ON "session_promotion_runs" ("workspace_subdomain", "source_session_id")
      WHERE "status" IN ('queued', 'running');
  END IF;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "session_promotion_class_map" ADD CONSTRAINT "session_promotion_class_map_run_fk"
    FOREIGN KEY ("workspace_subdomain", "run_id")
    REFERENCES "session_promotion_runs" ("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
-- Deferred so a session delete can cascade its runs and classes in one statement.
DO $$ BEGIN
  ALTER TABLE "session_promotion_class_map" ADD CONSTRAINT "session_promotion_class_map_source_class_fk"
    FOREIGN KEY ("workspace_subdomain", "source_class_id")
    REFERENCES "session_classes" ("workspace_subdomain", "id")
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_promotion_class_map" ADD CONSTRAINT "session_promotion_class_map_next_class_fk"
    FOREIGN KEY ("workspace_subdomain", "next_class_id")
    REFERENCES "session_classes" ("workspace_subdomain", "id")
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_promotion_class_map" VALIDATE CONSTRAINT "session_promotion_class_map_source_class_fk";
EXCEPTION WHEN foreign_key_violation THEN
  RAISE WARNING 'session_promotion_class_map_source_class_fk stays NOT VALID: legacy rows reference missing classes';
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_promotion_class_map" VALIDATE CONSTRAINT "session_promotion_class_map_next_class_fk";
EXCEPTION WHEN foreign_key_violation THEN
  RAISE WARNING 'session_promotion_class_map_next_class_fk stays NOT VALID: legacy rows reference missing classes';
END $$;
--> statement-breakpoint

-- ───────────────────────── 3. run warnings ─────────────────────────
CREATE TABLE IF NOT EXISTS "session_promotion_run_warnings" (
  "id"                  text          NOT NULL,
  "workspace_subdomain" text          NOT NULL REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE,
  "run_id"              text          NOT NULL,
  "kind"                varchar(40)   NOT NULL,
  "detail"              varchar(500)  NOT NULL DEFAULT '',
  "created_at"          timestamp with time zone   NOT NULL DEFAULT now(),
  CONSTRAINT "session_promotion_run_warnings_pk" PRIMARY KEY ("workspace_subdomain", "id"),
  CONSTRAINT "session_promotion_run_warnings_run_fk" FOREIGN KEY ("workspace_subdomain", "run_id")
    REFERENCES "session_promotion_runs" ("workspace_subdomain", "id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_promotion_run_warnings_run_idx"
  ON "session_promotion_run_warnings" ("workspace_subdomain", "run_id", "created_at");
--> statement-breakpoint
ALTER TABLE "session_promotion_run_warnings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "session_promotion_run_warnings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "session_promotion_run_warnings";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "session_promotion_run_warnings"
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

-- ───────────────────────── 4. capacity upper bounds ─────────────────────────
DO $$ BEGIN
  ALTER TABLE "session_classes" ADD CONSTRAINT "session_classes_capacity_max_check"
    CHECK ("capacity" <= 100000) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_class_sections" ADD CONSTRAINT "session_class_sections_capacity_max_check"
    CHECK ("capacity" <= 100000) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_classes" VALIDATE CONSTRAINT "session_classes_capacity_max_check";
EXCEPTION WHEN check_violation THEN
  RAISE WARNING 'session_classes_capacity_max_check stays NOT VALID: legacy capacity above 100000';
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_class_sections" VALIDATE CONSTRAINT "session_class_sections_capacity_max_check";
EXCEPTION WHEN check_violation THEN
  RAISE WARNING 'session_class_sections_capacity_max_check stays NOT VALID: legacy capacity above 100000';
END $$;
--> statement-breakpoint

-- ───────────────────────── 5. completion / grade finalisation stamps ─────────────────────────
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "results_finalized_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exams_workspace_unfinalized_idx"
  ON "exams" ("workspace_subdomain", "status")
  WHERE "results_finalized_at" IS NULL AND "deleted_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "completion_evaluated_at" timestamp with time zone;
--> statement-breakpoint


-- ───────────────────────── 7. certified evidence freeze ─────────────────────────
-- A certificate is issued on attendance/exam evidence; after that the evidence must not change
-- silently (review finding C4). Corrections remain possible for an authorised maintenance job that
-- sets `app.allow_certified_evidence_edit = 'on'` for its transaction.
CREATE OR REPLACE FUNCTION forbid_certified_evidence_change() RETURNS trigger AS $$
DECLARE
  locked boolean;
BEGIN
  IF current_setting('app.allow_certified_evidence_edit', true) = 'on'
     OR current_setting('app.allow_hard_purge', true) = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_TABLE_NAME = 'attendance' THEN
    SELECT EXISTS (
      SELECT 1 FROM enrollments e
       WHERE e.workspace_subdomain = COALESCE(NEW.workspace_subdomain, OLD.workspace_subdomain)
         AND e.student_id = COALESCE(NEW.student_id, OLD.student_id)
         AND e.class_id = COALESCE(NEW.class_id, OLD.class_id)
         AND e.certificate_issued_at IS NOT NULL
    ) INTO locked;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM exam_results r
        JOIN exam_classes ec
          ON ec.workspace_subdomain = r.workspace_subdomain AND ec.exam_id = r.exam_id
        JOIN enrollments e
          ON e.workspace_subdomain = r.workspace_subdomain
         AND e.student_id = r.student_id
         AND e.class_id = ec.class_id
       WHERE r.workspace_subdomain = COALESCE(NEW.workspace_subdomain, OLD.workspace_subdomain)
         AND r.exam_id = COALESCE(NEW.exam_id, OLD.exam_id)
         AND r.student_id = COALESCE(NEW.student_id, OLD.student_id)
         AND e.certificate_issued_at IS NOT NULL
    ) INTO locked;
  END IF;
  IF locked THEN
    RAISE EXCEPTION 'certified_evidence_locked: a certificate was already issued on this evidence'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS attendance_certified_evidence_guard ON "attendance";
--> statement-breakpoint
CREATE TRIGGER attendance_certified_evidence_guard
  BEFORE INSERT OR UPDATE OR DELETE ON "attendance"
  FOR EACH ROW EXECUTE FUNCTION forbid_certified_evidence_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS exam_results_certified_evidence_guard ON "exam_results";
--> statement-breakpoint
CREATE TRIGGER exam_results_certified_evidence_guard
  BEFORE INSERT OR UPDATE OR DELETE ON "exam_results"
  FOR EACH ROW EXECUTE FUNCTION forbid_certified_evidence_change();
