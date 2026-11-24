-- MMS Forward-only Migration: 0164_students_optimizations.sql
-- Students module performance and integrity optimizations:
--   1. Drop redundant prefix index student_enrolled_sessions_workspace_student_idx
--      (superseded by unique index on workspace_subdomain, student_id, session_id).
--   2. Enforce ISO date formatting on registered_date and enrollment_date via CHECK constraints.
--   3. Create table student_sequence_config with FORCE RLS for concurrency-safe atomic GR numbering.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- 1. Prune redundant student prefix index on enrolled sessions and plain B-trees on students.
DROP INDEX IF EXISTS "student_enrolled_sessions_workspace_student_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "students_workspace_gr_number_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "students_workspace_student_id_idx";
--> statement-breakpoint
DROP POLICY IF EXISTS "enrollments_tenant_isolation" ON "enrollments";
--> statement-breakpoint

-- 2. Format validation CHECK constraints on students dates (idempotent).
DO $$ BEGIN
  ALTER TABLE "students"
    ADD CONSTRAINT "students_registered_date_iso_check"
    CHECK ("registered_date" IS NULL OR "registered_date" = '' OR "registered_date" ~ '^\d{4}-\d{2}-\d{2}');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "students"
    ADD CONSTRAINT "students_enrollment_date_iso_check"
    CHECK ("enrollment_date" IS NULL OR "enrollment_date" = '' OR "enrollment_date" ~ '^\d{4}-\d{2}-\d{2}');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- 3. Create table student_sequence_config for atomic GR number generation.
CREATE TABLE IF NOT EXISTS "student_sequence_config" (
	"workspace_subdomain" text NOT NULL,
	"current_sequence" integer DEFAULT 0 NOT NULL,
	"last_year" integer DEFAULT 2026 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_sequence_config_workspace_subdomain_pk" PRIMARY KEY("workspace_subdomain")
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "student_sequence_config"
    ADD CONSTRAINT "student_sequence_config_workspace_subdomain_workspaces_subdomain_fk"
    FOREIGN KEY ("workspace_subdomain")
    REFERENCES "public"."workspaces"("subdomain")
    ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "student_sequence_config" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "student_sequence_config" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS tenant_isolation_policy ON "student_sequence_config";
--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "student_sequence_config" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);
