-- MMS Forward-only Migration: 0166_academic_catalogs.sql
-- Academic master data (expand phase):
--   1. session_categories, programs, subjects — tenant-managed catalogs with stable ids.
--   2. Nullable FK columns: sessions.category_id / program_id, session_classes.program_id,
--      session_class_timetable_periods.subject_id, exams.subject_id.
--   3. Backfill defaults for every workspace + distinct legacy text values, then link rows by name.
--   Legacy text columns (sessions.type, periods.subject, exams.subject) stay as display snapshots.
--   Indexes on the large `sessions` table are built out of band:
--   src/scripts/academic_catalog_concurrent_indexes.sql

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ───────────────────────── session_categories ─────────────────────────
CREATE TABLE IF NOT EXISTS "session_categories" (
  "id"                   text          NOT NULL,
  "workspace_subdomain"  text          NOT NULL,
  "code"                 varchar(32),
  "name"                 varchar(150)  NOT NULL,
  "short_name"           varchar(32),
  "status"               varchar(20)   NOT NULL DEFAULT 'active',
  "sort_order"           integer       NOT NULL DEFAULT 0,
  "is_system"            boolean       NOT NULL DEFAULT false,
  "deleted_at"           timestamptz,
  "deleted_by"           text,
  "deletion_reason"      varchar(500),
  "restored_at"          timestamptz,
  "restored_by"          text,
  "deleted_with_cascade" boolean       DEFAULT false,
  "created_at"           timestamptz   NOT NULL DEFAULT now(),
  "updated_at"           timestamptz   NOT NULL DEFAULT now(),
  "created_by"           text,
  "updated_by"           text,
  CONSTRAINT "session_categories_ws_id_pk" PRIMARY KEY ("workspace_subdomain", "id"),
  CONSTRAINT "session_categories_status_check" CHECK ("status" IN ('active', 'archived')),
  CONSTRAINT "session_categories_name_not_blank_check" CHECK (btrim("name") <> ''),
  CONSTRAINT "session_categories_workspace_fk" FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_categories_workspace_deleted_idx" ON "session_categories" ("workspace_subdomain", "deleted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_categories_workspace_active_idx" ON "session_categories" ("workspace_subdomain", "status", "sort_order") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_categories_workspace_deleted_records_idx" ON "session_categories" ("workspace_subdomain", "deleted_at") WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "session_categories_workspace_name_active_uidx" ON "session_categories" ("workspace_subdomain", lower(btrim("name"))) WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "session_categories_workspace_code_active_uidx" ON "session_categories" ("workspace_subdomain", lower(btrim("code"))) WHERE "deleted_at" IS NULL AND "code" IS NOT NULL AND btrim("code") <> '';
--> statement-breakpoint
ALTER TABLE "session_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_categories" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "session_categories";
--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "session_categories"
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
DROP TRIGGER IF EXISTS "trg_session_categories_forbid_hard_delete" ON "session_categories";
--> statement-breakpoint
CREATE TRIGGER "trg_session_categories_forbid_hard_delete" BEFORE DELETE ON "session_categories" FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "update_session_categories_updated_at" ON "session_categories";
--> statement-breakpoint
CREATE TRIGGER "update_session_categories_updated_at" BEFORE UPDATE ON "session_categories" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint
ALTER TABLE "session_categories" SET (autovacuum_vacuum_scale_factor = 0.05);
--> statement-breakpoint

-- ───────────────────────── programs ─────────────────────────
CREATE TABLE IF NOT EXISTS "programs" (
  "id"                   text          NOT NULL,
  "workspace_subdomain"  text          NOT NULL,
  "code"                 varchar(32),
  "name"                 varchar(150)  NOT NULL,
  "short_name"           varchar(32),
  "status"               varchar(20)   NOT NULL DEFAULT 'active',
  "sort_order"           integer       NOT NULL DEFAULT 0,
  "is_system"            boolean       NOT NULL DEFAULT false,
  "deleted_at"           timestamptz,
  "deleted_by"           text,
  "deletion_reason"      varchar(500),
  "restored_at"          timestamptz,
  "restored_by"          text,
  "deleted_with_cascade" boolean       DEFAULT false,
  "created_at"           timestamptz   NOT NULL DEFAULT now(),
  "updated_at"           timestamptz   NOT NULL DEFAULT now(),
  "created_by"           text,
  "updated_by"           text,
  CONSTRAINT "programs_ws_id_pk" PRIMARY KEY ("workspace_subdomain", "id"),
  CONSTRAINT "programs_status_check" CHECK ("status" IN ('active', 'archived')),
  CONSTRAINT "programs_name_not_blank_check" CHECK (btrim("name") <> ''),
  CONSTRAINT "programs_workspace_fk" FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "programs_workspace_deleted_idx" ON "programs" ("workspace_subdomain", "deleted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "programs_workspace_active_idx" ON "programs" ("workspace_subdomain", "status", "sort_order") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "programs_workspace_deleted_records_idx" ON "programs" ("workspace_subdomain", "deleted_at") WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "programs_workspace_name_active_uidx" ON "programs" ("workspace_subdomain", lower(btrim("name"))) WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "programs_workspace_code_active_uidx" ON "programs" ("workspace_subdomain", lower(btrim("code"))) WHERE "deleted_at" IS NULL AND "code" IS NOT NULL AND btrim("code") <> '';
--> statement-breakpoint
ALTER TABLE "programs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "programs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "programs";
--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "programs"
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
DROP TRIGGER IF EXISTS "trg_programs_forbid_hard_delete" ON "programs";
--> statement-breakpoint
CREATE TRIGGER "trg_programs_forbid_hard_delete" BEFORE DELETE ON "programs" FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "update_programs_updated_at" ON "programs";
--> statement-breakpoint
CREATE TRIGGER "update_programs_updated_at" BEFORE UPDATE ON "programs" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint
ALTER TABLE "programs" SET (autovacuum_vacuum_scale_factor = 0.05);
--> statement-breakpoint

-- ───────────────────────── subjects ─────────────────────────
CREATE TABLE IF NOT EXISTS "subjects" (
  "id"                   text          NOT NULL,
  "workspace_subdomain"  text          NOT NULL,
  "code"                 varchar(32),
  "name"                 varchar(150)  NOT NULL,
  "short_name"           varchar(32),
  "status"               varchar(20)   NOT NULL DEFAULT 'active',
  "sort_order"           integer       NOT NULL DEFAULT 0,
  "is_system"            boolean       NOT NULL DEFAULT false,
  "deleted_at"           timestamptz,
  "deleted_by"           text,
  "deletion_reason"      varchar(500),
  "restored_at"          timestamptz,
  "restored_by"          text,
  "deleted_with_cascade" boolean       DEFAULT false,
  "created_at"           timestamptz   NOT NULL DEFAULT now(),
  "updated_at"           timestamptz   NOT NULL DEFAULT now(),
  "created_by"           text,
  "updated_by"           text,
  CONSTRAINT "subjects_ws_id_pk" PRIMARY KEY ("workspace_subdomain", "id"),
  CONSTRAINT "subjects_status_check" CHECK ("status" IN ('active', 'archived')),
  CONSTRAINT "subjects_name_not_blank_check" CHECK (btrim("name") <> ''),
  CONSTRAINT "subjects_workspace_fk" FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subjects_workspace_deleted_idx" ON "subjects" ("workspace_subdomain", "deleted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subjects_workspace_active_idx" ON "subjects" ("workspace_subdomain", "status", "sort_order") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subjects_workspace_deleted_records_idx" ON "subjects" ("workspace_subdomain", "deleted_at") WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subjects_workspace_name_active_uidx" ON "subjects" ("workspace_subdomain", lower(btrim("name"))) WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subjects_workspace_code_active_uidx" ON "subjects" ("workspace_subdomain", lower(btrim("code"))) WHERE "deleted_at" IS NULL AND "code" IS NOT NULL AND btrim("code") <> '';
--> statement-breakpoint
ALTER TABLE "subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subjects" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "subjects";
--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "subjects"
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
DROP TRIGGER IF EXISTS "trg_subjects_forbid_hard_delete" ON "subjects";
--> statement-breakpoint
CREATE TRIGGER "trg_subjects_forbid_hard_delete" BEFORE DELETE ON "subjects" FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "update_subjects_updated_at" ON "subjects";
--> statement-breakpoint
CREATE TRIGGER "update_subjects_updated_at" BEFORE UPDATE ON "subjects" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint
ALTER TABLE "subjects" SET (autovacuum_vacuum_scale_factor = 0.05);
--> statement-breakpoint

-- ───────────────────────── expand: nullable FK columns ─────────────────────────
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "category_id" text;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "program_id" text;
--> statement-breakpoint
ALTER TABLE "session_classes" ADD COLUMN IF NOT EXISTS "program_id" text;
--> statement-breakpoint
ALTER TABLE "session_class_timetable_periods" ADD COLUMN IF NOT EXISTS "subject_id" text;
--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "subject_id" text;
--> statement-breakpoint

-- ───────────────────────── backfill: system defaults per workspace ─────────────────────────
INSERT INTO "session_categories" ("id", "workspace_subdomain", "code", "name", "sort_order", "is_system")
SELECT gen_random_uuid()::text, w."subdomain", d.code, d.name, d.sort_order, true
  FROM "workspaces" w
 CROSS JOIN (VALUES
   ('academic_year', 'Academic Year', 0),
   ('term', 'Term', 1),
   ('short_course', 'Short Course', 2),
   ('workshop', 'Workshop', 3),
   ('camp', 'Camp', 4)
 ) AS d(code, name, sort_order)
ON CONFLICT ("workspace_subdomain", lower(btrim("name"))) WHERE "deleted_at" IS NULL DO NOTHING;
--> statement-breakpoint

INSERT INTO "programs" ("id", "workspace_subdomain", "code", "name", "sort_order", "is_system")
SELECT gen_random_uuid()::text, w."subdomain", d.code, d.name, d.sort_order, true
  FROM "workspaces" w
 CROSS JOIN (VALUES
   ('hifz', 'Hifz', 0),
   ('nazra', 'Nazra', 1),
   ('qaidah', 'Qaidah', 2),
   ('tajweed', 'Tajweed', 3),
   ('dars_e_nizami', 'Dars-e-Nizami', 4)
 ) AS d(code, name, sort_order)
ON CONFLICT ("workspace_subdomain", lower(btrim("name"))) WHERE "deleted_at" IS NULL DO NOTHING;
--> statement-breakpoint

INSERT INTO "subjects" ("id", "workspace_subdomain", "code", "name", "sort_order", "is_system")
SELECT gen_random_uuid()::text, w."subdomain", d.code, d.name, d.sort_order, true
  FROM "workspaces" w
 CROSS JOIN (VALUES
   ('quran_memorization', 'Quran Memorization', 0),
   ('quran_recitation', 'Quran Recitation', 1),
   ('tajweed', 'Tajweed', 2),
   ('arabic', 'Arabic', 3),
   ('fiqh', 'Fiqh', 4),
   ('aqeedah', 'Aqeedah', 5),
   ('islamic_studies', 'Islamic Studies', 6)
 ) AS d(code, name, sort_order)
ON CONFLICT ("workspace_subdomain", lower(btrim("name"))) WHERE "deleted_at" IS NULL DO NOTHING;
--> statement-breakpoint

-- ───────────────────────── backfill: legacy free-text values ─────────────────────────
-- Former "session types" (lookup list + sessions.type) are programs; 'academic' was the category default.
INSERT INTO "programs" ("id", "workspace_subdomain", "name", "sort_order")
SELECT gen_random_uuid()::text, v.ws, v.name, 100
  FROM (
    SELECT DISTINCT ON (ws, lower(btrim(name))) ws, btrim(name) AS name
      FROM (
        SELECT "workspace_subdomain" AS ws, "label" AS name FROM "session_lookups" WHERE "kind" = 'types'
        UNION ALL
        SELECT "workspace_subdomain", "type" FROM "sessions"
      ) src
     WHERE name IS NOT NULL AND btrim(name) <> '' AND lower(btrim(name)) <> 'academic'
  ) v
ON CONFLICT ("workspace_subdomain", lower(btrim("name"))) WHERE "deleted_at" IS NULL DO NOTHING;
--> statement-breakpoint

INSERT INTO "subjects" ("id", "workspace_subdomain", "name", "sort_order")
SELECT gen_random_uuid()::text, v.ws, left(v.name, 150), 100
  FROM (
    SELECT DISTINCT ON (ws, lower(btrim(name))) ws, btrim(name) AS name
      FROM (
        SELECT "workspace_subdomain" AS ws, "subject" AS name FROM "session_class_timetable_periods"
        UNION ALL
        SELECT "workspace_subdomain", "subject" FROM "exams"
      ) src
     WHERE name IS NOT NULL AND btrim(name) <> ''
  ) v
ON CONFLICT ("workspace_subdomain", lower(btrim("name"))) WHERE "deleted_at" IS NULL DO NOTHING;
--> statement-breakpoint

-- ───────────────────────── backfill: link rows by normalized name ─────────────────────────
UPDATE "sessions" s
   SET "category_id" = c."id"
  FROM "session_categories" c
 WHERE s."category_id" IS NULL
   AND c."workspace_subdomain" = s."workspace_subdomain"
   AND c."code" = 'academic_year'
   AND c."deleted_at" IS NULL;
--> statement-breakpoint

UPDATE "sessions" s
   SET "program_id" = p."id"
  FROM "programs" p
 WHERE s."program_id" IS NULL
   AND p."workspace_subdomain" = s."workspace_subdomain"
   AND lower(btrim(p."name")) = lower(btrim(s."type"))
   AND p."deleted_at" IS NULL;
--> statement-breakpoint

UPDATE "session_classes" c
   SET "program_id" = s."program_id"
  FROM "sessions" s
 WHERE c."program_id" IS NULL
   AND s."workspace_subdomain" = c."workspace_subdomain"
   AND s."id" = c."session_id"
   AND s."program_id" IS NOT NULL;
--> statement-breakpoint

UPDATE "session_class_timetable_periods" p
   SET "subject_id" = sub."id"
  FROM "subjects" sub
 WHERE p."subject_id" IS NULL
   AND sub."workspace_subdomain" = p."workspace_subdomain"
   AND lower(btrim(sub."name")) = lower(btrim(p."subject"))
   AND sub."deleted_at" IS NULL;
--> statement-breakpoint

UPDATE "exams" e
   SET "subject_id" = sub."id"
  FROM "subjects" sub
 WHERE e."subject_id" IS NULL
   AND sub."workspace_subdomain" = e."workspace_subdomain"
   AND lower(btrim(sub."name")) = lower(btrim(e."subject"))
   AND sub."deleted_at" IS NULL;
--> statement-breakpoint

-- ───────────────────────── foreign keys (NOT VALID, then VALIDATE without blocking writes) ─────────────────────────
DO $$ BEGIN
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_category_fk"
    FOREIGN KEY ("workspace_subdomain", "category_id")
    REFERENCES "session_categories" ("workspace_subdomain", "id") ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_program_fk"
    FOREIGN KEY ("workspace_subdomain", "program_id")
    REFERENCES "programs" ("workspace_subdomain", "id") ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_classes" ADD CONSTRAINT "session_classes_program_fk"
    FOREIGN KEY ("workspace_subdomain", "program_id")
    REFERENCES "programs" ("workspace_subdomain", "id") ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_class_timetable_periods" ADD CONSTRAINT "session_class_timetable_periods_subject_fk"
    FOREIGN KEY ("workspace_subdomain", "subject_id")
    REFERENCES "subjects" ("workspace_subdomain", "id") ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "exams" ADD CONSTRAINT "exams_subject_fk"
    FOREIGN KEY ("workspace_subdomain", "subject_id")
    REFERENCES "subjects" ("workspace_subdomain", "id") ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "sessions" VALIDATE CONSTRAINT "sessions_category_fk";
--> statement-breakpoint
ALTER TABLE "sessions" VALIDATE CONSTRAINT "sessions_program_fk";
--> statement-breakpoint
ALTER TABLE "session_classes" VALIDATE CONSTRAINT "session_classes_program_fk";
--> statement-breakpoint
ALTER TABLE "session_class_timetable_periods" VALIDATE CONSTRAINT "session_class_timetable_periods_subject_fk";
--> statement-breakpoint
ALTER TABLE "exams" VALIDATE CONSTRAINT "exams_subject_fk";
--> statement-breakpoint

-- FK backing indexes on small tables (sessions indexes: see the out-of-band script).
CREATE INDEX IF NOT EXISTS "session_classes_workspace_program_idx"
  ON "session_classes" ("workspace_subdomain", "program_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_class_timetable_periods_workspace_subject_idx"
  ON "session_class_timetable_periods" ("workspace_subdomain", "subject_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exams_workspace_subject_idx"
  ON "exams" ("workspace_subdomain", "subject_id");
