-- MMS Forward-only Migration: 0222_exam_attendance_gate.sql
-- Exam attendance eligibility (docs/attendance-specialized-subsystems-audit-2026-11-09.md):
--   1. `exams.min_attendance_pct` — a per-exam gate; null inherits the session's completion
--      threshold, 0 disables it.
--   2. `exam_eligibility_overrides` — the audited, revocable way to let one student sit anyway.
--   3. `exam_results` natural-key uniqueness + a non-negative marks guard. Results were upserted by
--      surrogate id only, so two rows for one (exam, student) were representable.
--
-- Hand-authored (reviewed exception, mms-schema-migrate §2): `drizzle-kit generate` is blocked by the
-- 0216/0217 snapshot-chain collision.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ───────────────────────── 1. the exam's own gate ─────────────────────────────────────────────
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "min_attendance_pct" smallint;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'exams'::regclass AND conname = 'exams_min_attendance_pct_check'
  ) THEN
    ALTER TABLE "exams" ADD CONSTRAINT "exams_min_attendance_pct_check"
      CHECK ("min_attendance_pct" IS NULL OR ("min_attendance_pct" BETWEEN 0 AND 100));
  END IF;
END $$;
--> statement-breakpoint

-- ───────────────────────── 2. audited overrides ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "exam_eligibility_overrides" (
  "workspace_subdomain"  text          NOT NULL,
  "exam_id"              text          NOT NULL,
  "student_id"           varchar(64)   NOT NULL,
  "reason"               varchar(500)  NOT NULL,
  "granted_by"           text,
  "granted_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "revoked_at"           timestamp with time zone,
  "revoked_by"           text,
  CONSTRAINT "exam_eligibility_overrides_pk"
    PRIMARY KEY ("workspace_subdomain", "exam_id", "student_id"),
  CONSTRAINT "exam_eligibility_overrides_reason_check" CHECK (btrim("reason") <> ''),
  CONSTRAINT "exam_eligibility_overrides_workspace_fk" FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE,
  CONSTRAINT "exam_eligibility_overrides_exam_fk" FOREIGN KEY ("workspace_subdomain", "exam_id")
    REFERENCES "exams" ("workspace_subdomain", "id") ON DELETE CASCADE,
  CONSTRAINT "exam_eligibility_overrides_student_fk" FOREIGN KEY ("workspace_subdomain", "student_id")
    REFERENCES "students" ("workspace_subdomain", "id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exam_eligibility_overrides_workspace_student_idx"
  ON "exam_eligibility_overrides" ("workspace_subdomain", "student_id");
--> statement-breakpoint
ALTER TABLE "exam_eligibility_overrides" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "exam_eligibility_overrides" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "exam_eligibility_overrides";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "exam_eligibility_overrides"
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

-- ───────────────────────── 3. one result per student per exam ─────────────────────────────────
-- Refuse to build the unique index over existing duplicates instead of silently failing the deploy:
-- report them and let the operator merge (the same guard style as 0207/0182).
DO $$
DECLARE
  duplicates bigint;
BEGIN
  SELECT count(*) INTO duplicates FROM (
    SELECT 1 FROM "exam_results"
     GROUP BY "workspace_subdomain", "exam_id", "student_id"
    HAVING count(*) > 1
  ) d;
  IF duplicates > 0 THEN
    RAISE WARNING
      'exam_results unique index skipped: % duplicate (exam, student) group(s) exist; merge them and re-run',
      duplicates;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS "exam_results_workspace_exam_student_uidx"
      ON "exam_results" ("workspace_subdomain", "exam_id", "student_id");
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'exam_results'::regclass AND conname = 'exam_results_marks_non_negative_check'
  ) THEN
    ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_marks_non_negative_check"
      CHECK ("marks_obtained" >= 0) NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "exam_results" VALIDATE CONSTRAINT "exam_results_marks_non_negative_check";
