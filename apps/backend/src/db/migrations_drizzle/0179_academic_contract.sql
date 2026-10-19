-- MMS Forward-only Migration: 0179_academic_contract.sql
-- Phase 12, release A of the contract (nothing is dropped here; release B / 0180 drops later).
-- From this release the app reads and writes only the new shapes:
--   catalog ids (sessions.program_id, period / exam subject_id) instead of text snapshots;
--   attendance.date_on, enrollments.enrolled_on, students.registered_on / enrollment_on;
--   student_session_memberships (view over enrollments + legacy pairs) instead of
--   student_enrolled_sessions.
-- The old columns / table stay populated by triggers, so the previous release keeps working if this
-- one is rolled back, and release B can drop them without breaking this one.
-- Pre-flight (read-only): pnpm --filter mms-backend audit:academic-contract

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ── 1. Catalog ids: link every text value (missing programs / subjects are created) ───────────
INSERT INTO "programs" ("id", "workspace_subdomain", "name")
SELECT gen_random_uuid()::text, src.ws, src.name
  FROM (
    SELECT DISTINCT ON (s."workspace_subdomain", lower(btrim(left(s."type", 150))))
           s."workspace_subdomain" AS ws, btrim(left(s."type", 150)) AS name
      FROM "sessions" s
     WHERE s."program_id" IS NULL AND btrim(COALESCE(s."type", '')) NOT IN ('', 'academic')
    UNION
    SELECT DISTINCT ON (l."workspace_subdomain", lower(btrim(left(l."label", 150))))
           l."workspace_subdomain", btrim(left(l."label", 150))
      FROM "session_lookups" l
     WHERE l."kind" = 'types' AND btrim(COALESCE(l."label", '')) NOT IN ('', 'academic')
  ) src
 WHERE NOT EXISTS (
   SELECT 1 FROM "programs" p
    WHERE p."workspace_subdomain" = src.ws AND p."deleted_at" IS NULL
      AND lower(btrim(p."name")) = lower(src.name))
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "sessions" s
   SET "program_id" = p."id"
  FROM "programs" p
 WHERE s."program_id" IS NULL AND btrim(COALESCE(s."type", '')) NOT IN ('', 'academic')
   AND p."workspace_subdomain" = s."workspace_subdomain" AND p."deleted_at" IS NULL
   AND lower(btrim(p."name")) = lower(btrim(left(s."type", 150)));
--> statement-breakpoint
INSERT INTO "subjects" ("id", "workspace_subdomain", "name")
SELECT gen_random_uuid()::text, src.ws, src.name
  FROM (
    SELECT DISTINCT ON (t."workspace_subdomain", lower(btrim(left(t."subject", 150))))
           t."workspace_subdomain" AS ws, btrim(left(t."subject", 150)) AS name
      FROM "session_class_timetable_periods" t
     WHERE t."subject_id" IS NULL AND btrim(COALESCE(t."subject", '')) <> ''
    UNION
    SELECT DISTINCT ON (x."workspace_subdomain", lower(btrim(left(x."subject", 150))))
           x."workspace_subdomain", btrim(left(x."subject", 150))
      FROM "exams" x
     WHERE x."subject_id" IS NULL AND btrim(COALESCE(x."subject", '')) <> ''
  ) src
 WHERE NOT EXISTS (
   SELECT 1 FROM "subjects" j
    WHERE j."workspace_subdomain" = src.ws AND j."deleted_at" IS NULL
      AND lower(btrim(j."name")) = lower(src.name))
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "session_class_timetable_periods" t
   SET "subject_id" = j."id"
  FROM "subjects" j
 WHERE t."subject_id" IS NULL AND btrim(COALESCE(t."subject", '')) <> ''
   AND j."workspace_subdomain" = t."workspace_subdomain" AND j."deleted_at" IS NULL
   AND lower(btrim(j."name")) = lower(btrim(left(t."subject", 150)));
--> statement-breakpoint
UPDATE "exams" x
   SET "subject_id" = j."id"
  FROM "subjects" j
 WHERE x."subject_id" IS NULL AND btrim(COALESCE(x."subject", '')) <> ''
   AND j."workspace_subdomain" = x."workspace_subdomain" AND j."deleted_at" IS NULL
   AND lower(btrim(j."name")) = lower(btrim(left(x."subject", 150)));
--> statement-breakpoint

-- Text snapshots are now written only by these triggers (from the linked catalog row), for the
-- previous release's readers. Release B drops the columns and the triggers.
CREATE OR REPLACE FUNCTION mms_sessions_type_snapshot() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.program_id IS NOT NULL THEN
    NEW.type := COALESCE((SELECT p.name FROM programs p
      WHERE p.workspace_subdomain = NEW.workspace_subdomain AND p.id = NEW.program_id), NEW.type);
  END IF;
  NEW.type := COALESCE(NULLIF(btrim(NEW.type), ''), 'academic');
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION mms_subject_snapshot() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.subject_id IS NOT NULL THEN
    NEW.subject := COALESCE((SELECT j.name FROM subjects j
      WHERE j.workspace_subdomain = NEW.workspace_subdomain AND j.id = NEW.subject_id), NEW.subject);
  END IF;
  NEW.subject := COALESCE(NEW.subject, '');
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_sessions_type_snapshot" ON "sessions";
--> statement-breakpoint
CREATE TRIGGER "trg_sessions_type_snapshot" BEFORE INSERT OR UPDATE ON "sessions"
  FOR EACH ROW EXECUTE FUNCTION mms_sessions_type_snapshot();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_periods_subject_snapshot" ON "session_class_timetable_periods";
--> statement-breakpoint
CREATE TRIGGER "trg_periods_subject_snapshot" BEFORE INSERT OR UPDATE ON "session_class_timetable_periods"
  FOR EACH ROW EXECUTE FUNCTION mms_subject_snapshot();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_exams_subject_snapshot" ON "exams";
--> statement-breakpoint
CREATE TRIGGER "trg_exams_subject_snapshot" BEFORE INSERT OR UPDATE ON "exams"
  FOR EACH ROW EXECUTE FUNCTION mms_subject_snapshot();
--> statement-breakpoint

-- ── 2. Dates: catch up, then sync both ways (new writes date_on; the old release writes date) ─
UPDATE "attendance" SET "date_on" = mms_try_date("date")
 WHERE "date_on" IS NULL AND mms_try_date("date") IS NOT NULL;
--> statement-breakpoint
UPDATE "enrollments" SET "enrolled_on" = mms_try_date("enrolled_date")
 WHERE "enrolled_on" IS NULL AND mms_try_date("enrolled_date") IS NOT NULL;
--> statement-breakpoint
UPDATE "students"
   SET "registered_on" = COALESCE("registered_on", mms_try_date("registered_date")),
       "enrollment_on" = COALESCE("enrollment_on", mms_try_date("enrollment_date"))
 WHERE ("registered_on" IS NULL AND mms_try_date("registered_date") IS NOT NULL)
    OR ("enrollment_on" IS NULL AND mms_try_date("enrollment_date") IS NOT NULL);
--> statement-breakpoint
-- A write that sets the date column wins; otherwise the varchar is converted (previous release).
CREATE OR REPLACE FUNCTION mms_sync_attendance_date_on() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.date_on IS NOT NULL THEN NEW.date := NEW.date_on::text;
    ELSE NEW.date_on := mms_try_date(NEW.date); END IF;
  ELSIF NEW.date_on IS DISTINCT FROM OLD.date_on THEN
    NEW.date := COALESCE(NEW.date_on::text, NEW.date);
  ELSIF NEW.date IS DISTINCT FROM OLD.date THEN
    NEW.date_on := mms_try_date(NEW.date);
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION mms_sync_enrollments_enrolled_on() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.enrolled_on IS NOT NULL THEN NEW.enrolled_date := NEW.enrolled_on::text;
    ELSE NEW.enrolled_on := mms_try_date(NEW.enrolled_date); END IF;
  ELSIF NEW.enrolled_on IS DISTINCT FROM OLD.enrolled_on THEN
    NEW.enrolled_date := COALESCE(NEW.enrolled_on::text, '');
  ELSIF NEW.enrolled_date IS DISTINCT FROM OLD.enrolled_date THEN
    NEW.enrolled_on := mms_try_date(NEW.enrolled_date);
  END IF;
  NEW.enrolled_date := COALESCE(NEW.enrolled_date, '');
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION mms_sync_students_date_on() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.registered_on IS NOT NULL THEN NEW.registered_date := NEW.registered_on::text;
    ELSE NEW.registered_on := mms_try_date(NEW.registered_date); END IF;
    IF NEW.enrollment_on IS NOT NULL THEN NEW.enrollment_date := NEW.enrollment_on::text;
    ELSE NEW.enrollment_on := mms_try_date(NEW.enrollment_date); END IF;
  ELSE
    IF NEW.registered_on IS DISTINCT FROM OLD.registered_on THEN
      NEW.registered_date := NEW.registered_on::text;
    ELSIF NEW.registered_date IS DISTINCT FROM OLD.registered_date THEN
      NEW.registered_on := mms_try_date(NEW.registered_date);
    END IF;
    IF NEW.enrollment_on IS DISTINCT FROM OLD.enrollment_on THEN
      NEW.enrollment_date := NEW.enrollment_on::text;
    ELSIF NEW.enrollment_date IS DISTINCT FROM OLD.enrollment_date THEN
      NEW.enrollment_on := mms_try_date(NEW.enrollment_date);
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint

-- ── 3. Membership: enrollments + legacy pairs; the old table is mirrored for the old release ──
CREATE TABLE IF NOT EXISTS "student_enrolled_sessions_legacy" (
  "id"                   text          NOT NULL,
  "workspace_subdomain"  text          NOT NULL,
  "student_id"           text          NOT NULL,
  "session_id"           varchar(100)  NOT NULL,
  "sort_order"           integer       NOT NULL DEFAULT 0,
  "created_at"           timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "student_enrolled_sessions_legacy_pk" PRIMARY KEY ("workspace_subdomain", "student_id", "id"),
  CONSTRAINT "student_enrolled_sessions_legacy_workspace_fk" FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE,
  CONSTRAINT "student_enrolled_sessions_legacy_student_fk" FOREIGN KEY ("workspace_subdomain", "student_id")
    REFERENCES "students" ("workspace_subdomain", "id") ON DELETE CASCADE,
  CONSTRAINT "student_enrolled_sessions_legacy_session_fk" FOREIGN KEY ("workspace_subdomain", "session_id")
    REFERENCES "sessions" ("workspace_subdomain", "id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "student_enrolled_sessions_legacy_pair_uidx" ON "student_enrolled_sessions_legacy" ("workspace_subdomain", "student_id", "session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_enrolled_sessions_legacy_session_idx" ON "student_enrolled_sessions_legacy" ("workspace_subdomain", "session_id");
--> statement-breakpoint
ALTER TABLE "student_enrolled_sessions_legacy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_enrolled_sessions_legacy" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "student_enrolled_sessions_legacy";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "student_enrolled_sessions_legacy"
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
-- Pairs with no enrollment history at all are the only memberships not derivable from enrollments.
INSERT INTO "student_enrolled_sessions_legacy" ("id", "workspace_subdomain", "student_id", "session_id", "sort_order", "created_at")
SELECT s."id", s."workspace_subdomain", s."student_id", s."session_id", s."sort_order", s."created_at"
  FROM "student_enrolled_sessions" s
 WHERE NOT EXISTS (
   SELECT 1 FROM "enrollments" e
    WHERE e."workspace_subdomain" = s."workspace_subdomain"
      AND e."student_id" = s."student_id" AND e."session_id" = s."session_id")
ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE OR REPLACE VIEW "student_session_memberships" WITH (security_invoker = true) AS
SELECT min(e."id") AS "id", e."workspace_subdomain", e."student_id", e."session_id",
       0 AS "sort_order", min(e."created_at") AS "created_at"
  FROM "enrollments" e
 WHERE e."deleted_at" IS NULL
   AND e."status" NOT IN ('cancelled', 'withdrawn', 'promoted', 'retained', 'graduated', 'left')
   AND EXISTS (SELECT 1 FROM "sessions" ses
                WHERE ses."workspace_subdomain" = e."workspace_subdomain" AND ses."id" = e."session_id")
 GROUP BY e."workspace_subdomain", e."student_id", e."session_id"
UNION ALL
SELECT l."id", l."workspace_subdomain", l."student_id", l."session_id", l."sort_order", l."created_at"
  FROM "student_enrolled_sessions_legacy" l
 WHERE NOT EXISTS (
   SELECT 1 FROM "enrollments" h
    WHERE h."workspace_subdomain" = l."workspace_subdomain"
      AND h."student_id" = l."student_id" AND h."session_id" = l."session_id");
--> statement-breakpoint
-- Keeps the old table in step with enrollments (the rule the old app code applied on every save).
CREATE OR REPLACE FUNCTION mms_mirror_enrolled_session(ws text, student text, session text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF ws IS NULL OR student IS NULL OR session IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM enrollments a
              WHERE a.workspace_subdomain = ws AND a.student_id = student AND a.session_id = session
                AND a.deleted_at IS NULL
                AND a.status NOT IN ('cancelled', 'withdrawn', 'promoted', 'retained', 'graduated', 'left'))
     AND EXISTS (SELECT 1 FROM sessions ses WHERE ses.workspace_subdomain = ws AND ses.id = session) THEN
    INSERT INTO student_enrolled_sessions (id, workspace_subdomain, student_id, session_id, sort_order)
    VALUES (student || '_sess_' || md5(session), ws, student, session, 0)
    ON CONFLICT (workspace_subdomain, student_id, session_id) DO NOTHING;
  ELSE
    DELETE FROM student_enrolled_sessions
     WHERE workspace_subdomain = ws AND student_id = student AND session_id = session;
  END IF;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION mms_mirror_enrolled_sessions_from_enrollment() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM mms_mirror_enrolled_session(OLD.workspace_subdomain, OLD.student_id, OLD.session_id);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    PERFORM mms_mirror_enrolled_session(NEW.workspace_subdomain, NEW.student_id, NEW.session_id);
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION mms_mirror_enrolled_sessions_from_legacy() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO student_enrolled_sessions (id, workspace_subdomain, student_id, session_id, sort_order)
  VALUES (NEW.id, NEW.workspace_subdomain, NEW.student_id, NEW.session_id, NEW.sort_order)
  ON CONFLICT (workspace_subdomain, student_id, session_id) DO NOTHING;
  RETURN NULL;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_enrollments_mirror_enrolled_sessions" ON "enrollments";
--> statement-breakpoint
CREATE TRIGGER "trg_enrollments_mirror_enrolled_sessions"
  AFTER INSERT OR UPDATE OF "student_id", "session_id", "status", "deleted_at" OR DELETE ON "enrollments"
  FOR EACH ROW EXECUTE FUNCTION mms_mirror_enrolled_sessions_from_enrollment();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_legacy_mirror_enrolled_sessions" ON "student_enrolled_sessions_legacy";
--> statement-breakpoint
CREATE TRIGGER "trg_legacy_mirror_enrolled_sessions" AFTER INSERT ON "student_enrolled_sessions_legacy"
  FOR EACH ROW EXECUTE FUNCTION mms_mirror_enrolled_sessions_from_legacy();
