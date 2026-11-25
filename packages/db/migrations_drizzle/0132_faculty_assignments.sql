-- MMS Forward-only Migration: 0132_faculty_assignments.sql
-- Creates the faculty_assignments multi-role temporal assignment table with:
--   • FK → faculty, faculty_departments, faculty_designations
--   • Self-referencing reports_to_assignment_id for assignment-level org-chart CTEs
--   • RLS policies, soft-delete columns, partial indexes
-- Backfills from faculty_designation_assignments + faculty.department (via faculty_departments)

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "faculty_assignments" (
  "id"                       text          NOT NULL,
  "workspace_subdomain"      text          NOT NULL,
  "faculty_id"               text          NOT NULL,
  "department_id"            text          NOT NULL,
  "designation_id"           text          NOT NULL,
  "reports_to_assignment_id" text,
  "is_primary"               boolean       NOT NULL DEFAULT false,
  "start_date"               date          NOT NULL,
  "end_date"                 date,
  "notes"                    text,
  -- soft-delete columns
  "deleted_at"               timestamptz,
  "deleted_by"               text,
  "deletion_reason"          varchar(500),
  "restored_at"              timestamptz,
  "restored_by"              text,
  "deleted_with_cascade"     boolean       DEFAULT false,
  -- audit
  "created_at"               timestamptz   NOT NULL DEFAULT now(),
  "updated_at"               timestamptz   NOT NULL DEFAULT now(),
  "created_by"               text,
  "updated_by"               text,

  CONSTRAINT "faculty_assignments_ws_id_pk"
    PRIMARY KEY ("workspace_subdomain", "id"),

  CONSTRAINT "faculty_assignments_date_range_check"
    CHECK ("end_date" IS NULL OR "end_date" >= "start_date"),

  CONSTRAINT "faculty_assignments_no_self_reporting_check"
    CHECK ("reports_to_assignment_id" IS NULL OR "reports_to_assignment_id" <> "id"),

  CONSTRAINT "faculty_assignments_workspace_fk"
    FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain")
    ON DELETE CASCADE,

  CONSTRAINT "faculty_assignments_faculty_fk"
    FOREIGN KEY ("workspace_subdomain", "faculty_id")
    REFERENCES "faculty" ("workspace_subdomain", "id")
    ON DELETE CASCADE,

  CONSTRAINT "faculty_assignments_department_fk"
    FOREIGN KEY ("workspace_subdomain", "department_id")
    REFERENCES "faculty_departments" ("workspace_subdomain", "id")
    ON DELETE RESTRICT,

  CONSTRAINT "faculty_assignments_designation_fk"
    FOREIGN KEY ("workspace_subdomain", "designation_id")
    REFERENCES "faculty_designations" ("workspace_subdomain", "id")
    ON DELETE RESTRICT,

  CONSTRAINT "faculty_assignments_reports_to_fk"
    FOREIGN KEY ("workspace_subdomain", "reports_to_assignment_id")
    REFERENCES "faculty_assignments" ("workspace_subdomain", "id")
    ON DELETE SET NULL
);
--> statement-breakpoint

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "faculty_assignments_faculty_active_idx"
  ON "faculty_assignments" ("workspace_subdomain", "faculty_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "faculty_assignments_dept_active_idx"
  ON "faculty_assignments" ("workspace_subdomain", "department_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "faculty_assignments_designation_active_idx"
  ON "faculty_assignments" ("workspace_subdomain", "designation_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- Critical for recursive CTE downward traversal
CREATE INDEX IF NOT EXISTS "faculty_assignments_reports_to_active_idx"
  ON "faculty_assignments" ("workspace_subdomain", "reports_to_assignment_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "faculty_assignments_faculty_primary_active_idx"
  ON "faculty_assignments" ("workspace_subdomain", "faculty_id", "is_primary")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "faculty_assignments_faculty_open_active_idx"
  ON "faculty_assignments" ("workspace_subdomain", "faculty_id")
  WHERE "deleted_at" IS NULL AND "end_date" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "faculty_assignments_deleted_idx"
  ON "faculty_assignments" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint

-- ── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE "faculty_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "faculty_assignments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "tenant_isolation_policy" ON "faculty_assignments" FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  );
--> statement-breakpoint

-- ── updated_at trigger ───────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'update_faculty_assignments_updated_at'
      AND c.relname = 'faculty_assignments'
  ) THEN
    CREATE TRIGGER update_faculty_assignments_updated_at
      BEFORE UPDATE ON "faculty_assignments"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
--> statement-breakpoint

-- ── Backfill from existing temporal designation assignments ──────────────────
-- Maps each faculty_designation_assignment row to a faculty_assignment row using
-- the corresponding faculty_department row (matched by the faculty.department column)
-- or a synthetic 'General' fallback department.

-- Step 1: Ensure every workspace that has designation assignments has at least a
-- 'General' fallback department so FK constraints don't block the backfill.
INSERT INTO "faculty_departments" ("id", "workspace_subdomain", "name", "code", "created_at", "updated_at")
SELECT DISTINCT
  'fdep-' || substr(md5(fda."workspace_subdomain" || ':general'), 1, 24),
  fda."workspace_subdomain",
  'General',
  'general',
  now(),
  now()
FROM "faculty_designation_assignments" fda
ON CONFLICT ("workspace_subdomain", "code") WHERE "deleted_at" IS NULL DO NOTHING;
--> statement-breakpoint

-- ── Backfill from faculty_assignments ────────────────────────────────────────
-- Step 2: Insert faculty_assignments from designation assignments.
-- Uses the faculty.department column to resolve department_id; falls back to 'general'.
INSERT INTO "faculty_assignments" (
  "id",
  "workspace_subdomain",
  "faculty_id",
  "department_id",
  "designation_id",
  "is_primary",
  "start_date",
  "end_date",
  "notes",
  "created_at",
  "updated_at"
)
SELECT
  'fa-' || substr(md5(fda."workspace_subdomain" || ':' || fda."id"), 1, 24),
  fda."workspace_subdomain",
  fda."faculty_id",
  COALESCE(
    -- Try exact slug-match on department column
    (SELECT fd."id"
       FROM "faculty_departments" fd
      WHERE fd."workspace_subdomain" = fda."workspace_subdomain"
        AND fd."code" = substr(
              regexp_replace(lower(trim(COALESCE(f."department", ''))), '[^a-z0-9]+', '-', 'g'), 1, 32
            )
        AND fd."deleted_at" IS NULL
      LIMIT 1),
    -- Fallback to 'general' department created in Step 1
    (SELECT fd."id"
       FROM "faculty_departments" fd
      WHERE fd."workspace_subdomain" = fda."workspace_subdomain"
        AND fd."code" = 'general'
      LIMIT 1)
  ),
  fda."designation_id",
  -- Mark the most-recent open-ended assignment as primary
  (fda."ends_on" IS NULL) AS "is_primary",
  fda."starts_on",
  fda."ends_on",
  fda."notes",
  fda."created_at",
  fda."updated_at"
FROM "faculty_designation_assignments" fda
JOIN "faculty" f
  ON f."workspace_subdomain" = fda."workspace_subdomain"
 AND f."id" = fda."faculty_id"
ON CONFLICT ("workspace_subdomain", "id") DO NOTHING;
