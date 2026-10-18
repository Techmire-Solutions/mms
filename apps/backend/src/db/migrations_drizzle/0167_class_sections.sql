-- MMS Forward-only Migration: 0167_class_sections.sql
-- Phase 2 — Sections & section staff:
--   1. session_class_sections (class → sections A/B…), one default section "A" per existing class.
--   2. enrollments.section_id + roll_no (roll numbers are per section).
--   3. section_staff_assignments: effective-dated class / subject / assistant teachers (history kept).
--   4. section_student_roles: student monitors/assistants (enrollment-based, not faculty).
--   5. session_class_timetable_period_staff: optional extra teachers per timetable period.
--   6. attendance.marked_by / exam_results.marked_by for teacher-of-record reporting.
--   Indexes on the large `enrollments` table are built out of band:
--   src/scripts/class_sections_concurrent_indexes.sql

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ───────────────────────── session_class_sections ─────────────────────────
CREATE TABLE IF NOT EXISTS "session_class_sections" (
  "id"                   text          NOT NULL,
  "workspace_subdomain"  text          NOT NULL,
  "session_id"           text          NOT NULL,
  "class_id"             text          NOT NULL,
  "name"                 varchar(50)   NOT NULL,
  "capacity"             integer       NOT NULL DEFAULT 30,
  "room"                 varchar(100),
  "status"               varchar(20)   NOT NULL DEFAULT 'active',
  "sort_order"           integer       NOT NULL DEFAULT 0,
  "created_at"           timestamptz   NOT NULL DEFAULT now(),
  "updated_at"           timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "session_class_sections_ws_id_pk" PRIMARY KEY ("workspace_subdomain", "id"),
  CONSTRAINT "session_class_sections_status_check" CHECK ("status" IN ('active', 'closed')),
  CONSTRAINT "session_class_sections_capacity_check" CHECK ("capacity" >= 0),
  CONSTRAINT "session_class_sections_name_not_blank_check" CHECK (btrim("name") <> ''),
  CONSTRAINT "session_class_sections_workspace_fk" FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE,
  CONSTRAINT "session_class_sections_class_fk" FOREIGN KEY ("workspace_subdomain", "session_id", "class_id")
    REFERENCES "session_classes" ("workspace_subdomain", "session_id", "id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_class_sections_workspace_class_idx" ON "session_class_sections" ("workspace_subdomain", "class_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_class_sections_workspace_session_idx" ON "session_class_sections" ("workspace_subdomain", "session_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "session_class_sections_class_name_uidx" ON "session_class_sections" ("workspace_subdomain", "class_id", lower(btrim("name")));
--> statement-breakpoint
ALTER TABLE "session_class_sections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_class_sections" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "session_class_sections";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "session_class_sections"
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
DROP TRIGGER IF EXISTS "update_session_class_sections_updated_at" ON "session_class_sections";
--> statement-breakpoint
CREATE TRIGGER "update_session_class_sections_updated_at" BEFORE UPDATE ON "session_class_sections" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint

-- ───────────────────────── section_staff_assignments ─────────────────────────
CREATE TABLE IF NOT EXISTS "section_staff_assignments" (
  "id"                   text          NOT NULL,
  "workspace_subdomain"  text          NOT NULL,
  "section_id"           text          NOT NULL,
  "faculty_id"           text          NOT NULL,
  "role"                 varchar(30)   NOT NULL,
  "subject_id"           text,
  "start_on"             date          NOT NULL,
  "end_on"               date,
  "change_reason"        varchar(500),
  "created_by"           text,
  "deleted_at"           timestamptz,
  "deleted_by"           text,
  "deletion_reason"      varchar(500),
  "restored_at"          timestamptz,
  "restored_by"          text,
  "deleted_with_cascade" boolean       DEFAULT false,
  "created_at"           timestamptz   NOT NULL DEFAULT now(),
  "updated_at"           timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "section_staff_assignments_ws_id_pk" PRIMARY KEY ("workspace_subdomain", "id"),
  CONSTRAINT "section_staff_assignments_role_check" CHECK ("role" IN ('class_teacher', 'subject_teacher', 'assistant')),
  CONSTRAINT "section_staff_assignments_period_check" CHECK ("end_on" IS NULL OR "end_on" >= "start_on"),
  CONSTRAINT "section_staff_assignments_workspace_fk" FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE,
  CONSTRAINT "section_staff_assignments_section_fk" FOREIGN KEY ("workspace_subdomain", "section_id")
    REFERENCES "session_class_sections" ("workspace_subdomain", "id") ON DELETE CASCADE,
  CONSTRAINT "section_staff_assignments_faculty_fk" FOREIGN KEY ("workspace_subdomain", "faculty_id")
    REFERENCES "faculty" ("workspace_subdomain", "id") ON DELETE RESTRICT,
  CONSTRAINT "section_staff_assignments_subject_fk" FOREIGN KEY ("workspace_subdomain", "subject_id")
    REFERENCES "subjects" ("workspace_subdomain", "id") ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "section_staff_assignments_section_active_idx" ON "section_staff_assignments" ("workspace_subdomain", "section_id", "start_on") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "section_staff_assignments_faculty_active_idx" ON "section_staff_assignments" ("workspace_subdomain", "faculty_id", "start_on") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "section_staff_assignments_subject_idx" ON "section_staff_assignments" ("workspace_subdomain", "subject_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "section_staff_assignments_workspace_deleted_idx" ON "section_staff_assignments" ("workspace_subdomain", "deleted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "section_staff_assignments_deleted_records_idx" ON "section_staff_assignments" ("workspace_subdomain", "deleted_at") WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "section_staff_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "section_staff_assignments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "section_staff_assignments";
--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "section_staff_assignments"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
      AND ("deleted_at" IS NULL OR current_setting('app.include_deleted', true) = 'true')
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  );
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_section_staff_assignments_forbid_hard_delete" ON "section_staff_assignments";
--> statement-breakpoint
CREATE TRIGGER "trg_section_staff_assignments_forbid_hard_delete" BEFORE DELETE ON "section_staff_assignments" FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "update_section_staff_assignments_updated_at" ON "section_staff_assignments";
--> statement-breakpoint
CREATE TRIGGER "update_section_staff_assignments_updated_at" BEFORE UPDATE ON "section_staff_assignments" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint
ALTER TABLE "section_staff_assignments" SET (autovacuum_vacuum_scale_factor = 0.05);
--> statement-breakpoint

-- ───────────────────────── section_student_roles ─────────────────────────
CREATE TABLE IF NOT EXISTS "section_student_roles" (
  "id"                   text          NOT NULL,
  "workspace_subdomain"  text          NOT NULL,
  "section_id"           text          NOT NULL,
  "enrollment_id"        text          NOT NULL,
  "role"                 varchar(30)   NOT NULL,
  "start_on"             date          NOT NULL,
  "end_on"               date,
  "created_by"           text,
  "deleted_at"           timestamptz,
  "deleted_by"           text,
  "deletion_reason"      varchar(500),
  "restored_at"          timestamptz,
  "restored_by"          text,
  "deleted_with_cascade" boolean       DEFAULT false,
  "created_at"           timestamptz   NOT NULL DEFAULT now(),
  "updated_at"           timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "section_student_roles_ws_id_pk" PRIMARY KEY ("workspace_subdomain", "id"),
  CONSTRAINT "section_student_roles_role_check" CHECK ("role" IN ('monitor', 'assistant')),
  CONSTRAINT "section_student_roles_period_check" CHECK ("end_on" IS NULL OR "end_on" >= "start_on"),
  CONSTRAINT "section_student_roles_workspace_fk" FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE,
  CONSTRAINT "section_student_roles_section_fk" FOREIGN KEY ("workspace_subdomain", "section_id")
    REFERENCES "session_class_sections" ("workspace_subdomain", "id") ON DELETE CASCADE,
  CONSTRAINT "section_student_roles_enrollment_fk" FOREIGN KEY ("workspace_subdomain", "enrollment_id")
    REFERENCES "enrollments" ("workspace_subdomain", "id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "section_student_roles_section_active_idx" ON "section_student_roles" ("workspace_subdomain", "section_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "section_student_roles_enrollment_idx" ON "section_student_roles" ("workspace_subdomain", "enrollment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "section_student_roles_workspace_deleted_idx" ON "section_student_roles" ("workspace_subdomain", "deleted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "section_student_roles_deleted_records_idx" ON "section_student_roles" ("workspace_subdomain", "deleted_at") WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "section_student_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "section_student_roles" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "section_student_roles";
--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "section_student_roles"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
      AND ("deleted_at" IS NULL OR current_setting('app.include_deleted', true) = 'true')
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  );
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_section_student_roles_forbid_hard_delete" ON "section_student_roles";
--> statement-breakpoint
CREATE TRIGGER "trg_section_student_roles_forbid_hard_delete" BEFORE DELETE ON "section_student_roles" FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "update_section_student_roles_updated_at" ON "section_student_roles";
--> statement-breakpoint
CREATE TRIGGER "update_section_student_roles_updated_at" BEFORE UPDATE ON "section_student_roles" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint

-- ───────────────────────── session_class_timetable_period_staff ─────────────────────────
CREATE TABLE IF NOT EXISTS "session_class_timetable_period_staff" (
  "id"                   text          NOT NULL,
  "workspace_subdomain"  text          NOT NULL,
  "period_id"            text          NOT NULL,
  "faculty_id"           text          NOT NULL,
  "role"                 varchar(30)   NOT NULL DEFAULT 'assistant',
  "created_at"           timestamptz   NOT NULL DEFAULT now(),
  "updated_at"           timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "session_class_timetable_period_staff_ws_id_pk" PRIMARY KEY ("workspace_subdomain", "id"),
  CONSTRAINT "session_class_timetable_period_staff_role_check" CHECK ("role" IN ('assistant', 'co_teacher')),
  CONSTRAINT "session_class_timetable_period_staff_workspace_fk" FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE,
  CONSTRAINT "session_class_timetable_period_staff_faculty_fk" FOREIGN KEY ("workspace_subdomain", "faculty_id")
    REFERENCES "faculty" ("workspace_subdomain", "id") ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_class_timetable_period_staff_period_idx" ON "session_class_timetable_period_staff" ("workspace_subdomain", "period_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_class_timetable_period_staff_faculty_idx" ON "session_class_timetable_period_staff" ("workspace_subdomain", "faculty_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "session_class_timetable_period_staff_period_faculty_uidx" ON "session_class_timetable_period_staff" ("workspace_subdomain", "period_id", "faculty_id");
--> statement-breakpoint
ALTER TABLE "session_class_timetable_period_staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_class_timetable_period_staff" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "session_class_timetable_period_staff";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "session_class_timetable_period_staff"
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
DROP TRIGGER IF EXISTS "update_session_class_timetable_period_staff_updated_at" ON "session_class_timetable_period_staff";
--> statement-breakpoint
CREATE TRIGGER "update_session_class_timetable_period_staff_updated_at" BEFORE UPDATE ON "session_class_timetable_period_staff" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint

-- ───────────────────────── expand: enrollments / attendance / exam_results ─────────────────────────
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "section_id" text;
--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "roll_no" varchar(64);
--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "marked_by" text;
--> statement-breakpoint
ALTER TABLE "exam_results" ADD COLUMN IF NOT EXISTS "marked_by" text;
--> statement-breakpoint

-- ───────────────────────── backfill ─────────────────────────
-- One default section "A" per class, inheriting capacity, room and status.
INSERT INTO "session_class_sections" ("id", "workspace_subdomain", "session_id", "class_id", "name", "capacity", "room", "status", "sort_order")
SELECT gen_random_uuid()::text, c."workspace_subdomain", c."session_id", c."id", 'A',
       GREATEST(c."capacity", 0), NULLIF(btrim(c."room"), ''),
       CASE WHEN c."status" = 'inactive' THEN 'closed' ELSE 'active' END, 0
  FROM "session_classes" c
 WHERE NOT EXISTS (
   SELECT 1 FROM "session_class_sections" s
    WHERE s."workspace_subdomain" = c."workspace_subdomain" AND s."class_id" = c."id"
 );
--> statement-breakpoint

-- Class teacher (class faculty) → open class_teacher assignment on the default section.
INSERT INTO "section_staff_assignments" ("id", "workspace_subdomain", "section_id", "faculty_id", "role", "start_on", "change_reason")
SELECT gen_random_uuid()::text, s."workspace_subdomain", s."id", c."faculty_id", 'class_teacher',
       CASE WHEN ses."start_date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN left(ses."start_date", 10)::date ELSE CURRENT_DATE END,
       'Backfilled from class teacher'
  FROM "session_class_sections" s
  JOIN "session_classes" c ON c."workspace_subdomain" = s."workspace_subdomain" AND c."id" = s."class_id"
  JOIN "sessions" ses ON ses."workspace_subdomain" = c."workspace_subdomain" AND ses."id" = c."session_id"
  JOIN "faculty" f ON f."workspace_subdomain" = c."workspace_subdomain" AND f."id" = c."faculty_id"
 WHERE s."sort_order" = 0
   AND NOT EXISTS (
     SELECT 1 FROM "section_staff_assignments" a
      WHERE a."workspace_subdomain" = s."workspace_subdomain" AND a."section_id" = s."id" AND a."role" = 'class_teacher'
   );
--> statement-breakpoint

-- Timetable period teachers → open subject_teacher assignments (one per teacher × subject).
INSERT INTO "section_staff_assignments" ("id", "workspace_subdomain", "section_id", "faculty_id", "role", "subject_id", "start_on", "change_reason")
SELECT gen_random_uuid()::text, v.ws, v.section_id, v.faculty_id, 'subject_teacher', v.subject_id, v.start_on, 'Backfilled from timetable'
  FROM (
    SELECT DISTINCT s."workspace_subdomain" AS ws, s."id" AS section_id, p."faculty_id", p."subject_id",
           CASE WHEN ses."start_date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN left(ses."start_date", 10)::date ELSE CURRENT_DATE END AS start_on
      FROM "session_class_timetable_periods" p
      JOIN "session_class_timetables" t ON t."workspace_subdomain" = p."workspace_subdomain" AND t."id" = p."timetable_id"
      JOIN "session_class_sections" s ON s."workspace_subdomain" = t."workspace_subdomain" AND s."class_id" = t."session_class_id" AND s."sort_order" = 0
      JOIN "sessions" ses ON ses."workspace_subdomain" = s."workspace_subdomain" AND ses."id" = s."session_id"
      JOIN "faculty" f ON f."workspace_subdomain" = p."workspace_subdomain" AND f."id" = p."faculty_id"
  ) v
 WHERE NOT EXISTS (
   SELECT 1 FROM "section_staff_assignments" a
    WHERE a."workspace_subdomain" = v.ws AND a."section_id" = v.section_id AND a."faculty_id" = v.faculty_id
      AND a."role" = 'subject_teacher' AND a."subject_id" IS NOT DISTINCT FROM v.subject_id
 );
--> statement-breakpoint

-- Enrollments → the class's default section.
UPDATE "enrollments" e
   SET "section_id" = s."id"
  FROM "session_class_sections" s
 WHERE e."section_id" IS NULL
   AND s."workspace_subdomain" = e."workspace_subdomain"
   AND s."session_id" = e."session_id"
   AND s."class_id" = e."class_id"
   AND s."sort_order" = 0;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_section_fk"
    FOREIGN KEY ("workspace_subdomain", "section_id")
    REFERENCES "session_class_sections" ("workspace_subdomain", "id") ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "enrollments" VALIDATE CONSTRAINT "enrollments_section_fk";
