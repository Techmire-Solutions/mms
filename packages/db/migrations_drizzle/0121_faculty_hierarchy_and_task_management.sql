-- MMS Forward-only Migration: 0121_faculty_hierarchy_and_task_management.sql
-- Adds hierarchy attributes (reporting_faculty_id, hierarchy_rank) to faculty table
-- with self-referencing foreign key and partial indexes for delegation authority.

-- 1. Add hierarchy columns to faculty
ALTER TABLE "faculty" ADD COLUMN IF NOT EXISTS "reporting_faculty_id" text;
--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN IF NOT EXISTS "hierarchy_rank" integer NOT NULL DEFAULT 10;
--> statement-breakpoint

-- 2. Foreign key constraint for reporting supervisor
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'faculty_workspace_subdomain_reporting_faculty_id_fk'
  ) THEN
    ALTER TABLE "faculty"
    ADD CONSTRAINT "faculty_workspace_subdomain_reporting_faculty_id_fk"
    FOREIGN KEY ("workspace_subdomain", "reporting_faculty_id")
    REFERENCES "faculty"("workspace_subdomain", "id")
    ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint

-- 3. Composite indexes for supervisory queries and hierarchy evaluation
CREATE INDEX IF NOT EXISTS "faculty_workspace_reporting_faculty_idx"
  ON "faculty" ("workspace_subdomain", "reporting_faculty_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "faculty_workspace_hierarchy_rank_idx"
  ON "faculty" ("workspace_subdomain", "hierarchy_rank")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "faculty_workspace_status_rank_idx"
  ON "faculty" ("workspace_subdomain", "status", "hierarchy_rank")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- 4. Ensure RLS remains forced and update views
ALTER TABLE "faculty" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "faculty" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP VIEW IF EXISTS "teachers";
--> statement-breakpoint
CREATE VIEW "teachers" AS SELECT * FROM "faculty";
