-- MMS Forward-only Migration: 0153_faculty_management_model.sql
-- Faculty Management model (expand phase):
--   departments  → name (unique, case-insensitive), description, status
--   designations → department_id, parent_designation_id, status
--   faculty      → designation_id, employment_start/end_date, performance_rating, 5-value status
-- Legacy columns (dept.parent_id/code/is_active, desig.code/hierarchy_rank/is_active,
-- faculty.join_date) are kept nullable/derived; the contract migration is a separate step.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ───────────────────────── faculty_departments ─────────────────────────
ALTER TABLE "faculty_departments" ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
ALTER TABLE "faculty_departments"
  ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE "faculty_departments" ALTER COLUMN "code" DROP NOT NULL;
--> statement-breakpoint
UPDATE "faculty_departments" SET "status" = 'inactive'
  WHERE "is_active" = false AND "status" <> 'inactive';
--> statement-breakpoint
-- Disambiguate case-insensitive duplicate names among live rows before the unique index.
WITH ranked AS (
  SELECT "workspace_subdomain", "id",
         row_number() OVER (
           PARTITION BY "workspace_subdomain", lower(btrim("name"))
           ORDER BY "created_at", "id"
         ) AS rn
  FROM "faculty_departments"
  WHERE "deleted_at" IS NULL
)
UPDATE "faculty_departments" d
   SET "name" = left(d."name", 255 - length(' (' || COALESCE(d."code", d."id") || ')'))
                || ' (' || COALESCE(d."code", d."id") || ')'
  FROM ranked r
 WHERE d."workspace_subdomain" = r."workspace_subdomain"
   AND d."id" = r."id"
   AND r.rn > 1;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "faculty_departments_ws_name_active_uidx"
  ON "faculty_departments" ("workspace_subdomain", lower(btrim("name")))
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "faculty_departments"
    ADD CONSTRAINT "faculty_departments_status_check"
    CHECK ("status" IN ('active', 'inactive'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- ───────────────────────── faculty_designations ─────────────────────────
ALTER TABLE "faculty_designations" ADD COLUMN IF NOT EXISTS "department_id" text;
--> statement-breakpoint
ALTER TABLE "faculty_designations" ADD COLUMN IF NOT EXISTS "parent_designation_id" text;
--> statement-breakpoint
ALTER TABLE "faculty_designations"
  ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE "faculty_designations" ALTER COLUMN "code" DROP NOT NULL;
--> statement-breakpoint
UPDATE "faculty_designations" SET "status" = 'inactive'
  WHERE "is_active" = false AND "status" <> 'inactive';
--> statement-breakpoint
-- Best-effort backfill: adopt the department most recently used with each designation.
UPDATE "faculty_designations" d
   SET "department_id" = picked."department_id"
  FROM (
    SELECT DISTINCT ON (a."workspace_subdomain", a."designation_id")
           a."workspace_subdomain", a."designation_id", a."department_id"
      FROM "faculty_assignments" a
      JOIN "faculty_departments" dep
        ON dep."workspace_subdomain" = a."workspace_subdomain"
       AND dep."id" = a."department_id"
       AND dep."deleted_at" IS NULL
     WHERE a."deleted_at" IS NULL
       AND a."designation_id" IS NOT NULL
       AND a."department_id" IS NOT NULL
     ORDER BY a."workspace_subdomain", a."designation_id", a."is_primary" DESC, a."start_date" DESC NULLS LAST
  ) picked
 WHERE d."workspace_subdomain" = picked."workspace_subdomain"
   AND d."id" = picked."designation_id"
   AND d."department_id" IS NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "faculty_designations"
    ADD CONSTRAINT "faculty_designations_department_fk"
    FOREIGN KEY ("workspace_subdomain", "department_id")
    REFERENCES "faculty_departments" ("workspace_subdomain", "id")
    ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "faculty_designations"
    ADD CONSTRAINT "faculty_designations_parent_fk"
    FOREIGN KEY ("workspace_subdomain", "parent_designation_id")
    REFERENCES "faculty_designations" ("workspace_subdomain", "id")
    ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "faculty_designations"
    ADD CONSTRAINT "faculty_designations_status_check"
    CHECK ("status" IN ('active', 'inactive'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "faculty_designations"
    ADD CONSTRAINT "faculty_designations_no_self_parent_check"
    CHECK ("parent_designation_id" IS NULL OR "parent_designation_id" <> "id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "faculty_designations_ws_dept_name_active_uidx"
  ON "faculty_designations" ("workspace_subdomain", "department_id", lower(btrim("name")))
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faculty_designations_department_active_idx"
  ON "faculty_designations" ("workspace_subdomain", "department_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faculty_designations_parent_active_idx"
  ON "faculty_designations" ("workspace_subdomain", "parent_designation_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- ───────────────────────────── faculty ─────────────────────────────
ALTER TABLE "faculty" ADD COLUMN IF NOT EXISTS "designation_id" text;
--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN IF NOT EXISTS "employment_start_date" date;
--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN IF NOT EXISTS "employment_end_date" date;
--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN IF NOT EXISTS "performance_rating" numeric(2, 1);
--> statement-breakpoint
UPDATE "faculty" SET "employment_start_date" = "join_date"
  WHERE "employment_start_date" IS NULL AND "join_date" IS NOT NULL;
--> statement-breakpoint
-- Backfill designation_id from the current primary assignment.
UPDATE "faculty" f
   SET "designation_id" = picked."designation_id"
  FROM (
    SELECT DISTINCT ON (a."workspace_subdomain", a."faculty_id")
           a."workspace_subdomain", a."faculty_id", a."designation_id"
      FROM "faculty_assignments" a
      JOIN "faculty_designations" des
        ON des."workspace_subdomain" = a."workspace_subdomain"
       AND des."id" = a."designation_id"
       AND des."deleted_at" IS NULL
     WHERE a."deleted_at" IS NULL
       AND a."designation_id" IS NOT NULL
       AND (a."end_date" IS NULL OR a."end_date" >= CURRENT_DATE)
     ORDER BY a."workspace_subdomain", a."faculty_id", a."is_primary" DESC, a."start_date" DESC NULLS LAST
  ) picked
 WHERE f."workspace_subdomain" = picked."workspace_subdomain"
   AND f."id" = picked."faculty_id"
   AND f."designation_id" IS NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "faculty"
    ADD CONSTRAINT "faculty_designation_fk"
    FOREIGN KEY ("workspace_subdomain", "designation_id")
    REFERENCES "faculty_designations" ("workspace_subdomain", "id")
    ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faculty_workspace_designation_active_idx"
  ON "faculty" ("workspace_subdomain", "designation_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "faculty" DROP CONSTRAINT IF EXISTS "faculty_status_check";
--> statement-breakpoint
ALTER TABLE "faculty"
  ADD CONSTRAINT "faculty_status_check"
  CHECK (lower(btrim("status")) IN ('active', 'on_leave', 'inactive', 'retired', 'terminated'));
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "faculty"
    ADD CONSTRAINT "faculty_employment_period_check"
    CHECK (
      "employment_end_date" IS NULL
      OR "employment_start_date" IS NULL
      OR "employment_end_date" >= "employment_start_date"
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "faculty"
    ADD CONSTRAINT "faculty_performance_rating_range_check"
    CHECK ("performance_rating" IS NULL OR ("performance_rating" >= 1.0 AND "performance_rating" <= 5.0));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
