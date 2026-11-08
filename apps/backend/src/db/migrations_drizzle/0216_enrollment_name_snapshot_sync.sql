-- MMS Forward-only Migration: 0216_enrollment_name_snapshot_sync.sql
-- Enrollments keep denormalized `student_name` / `session_name` / `class_name` snapshots (the
-- projection reads them directly for list/report/print performance). Nothing refreshed them on
-- rename, so screens showed the name captured at enrollment time. Triggers keep the snapshot in
-- step in the same transaction as the rename, including bulk imports; archived enrollments are
-- deliberately not touched (the RLS USING clause hides them, and trash keeps its last label).
--
-- Audit note: this is a denormalized copy refresh, not a business mutation — no audit row is
-- emitted per enrollment (a rename would otherwise create one row per historical enrollment).
SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

UPDATE "enrollments" e
   SET "student_name" = c."name"
  FROM "students" s
  JOIN "contacts" c
    ON c."workspace_subdomain" = s."workspace_subdomain" AND c."id" = s."contact_id"
 WHERE e."workspace_subdomain" = s."workspace_subdomain"
   AND e."student_id" = s."id"
   AND e."student_name" IS DISTINCT FROM c."name";
--> statement-breakpoint

UPDATE "enrollments" e
   SET "session_name" = s."name"
  FROM "sessions" s
 WHERE e."workspace_subdomain" = s."workspace_subdomain"
   AND e."session_id" = s."id"
   AND e."session_name" IS DISTINCT FROM s."name";
--> statement-breakpoint

UPDATE "enrollments" e
   SET "class_name" = c."name"
  FROM "session_classes" c
 WHERE e."workspace_subdomain" = c."workspace_subdomain"
   AND e."class_id" = c."id"
   AND e."class_name" IS DISTINCT FROM c."name";
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "mms_sync_enrollment_student_name"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."name" IS DISTINCT FROM OLD."name" THEN
    UPDATE "enrollments" e
       SET "student_name" = NEW."name", "updated_at" = now()
      FROM "students" s
     WHERE s."workspace_subdomain" = NEW."workspace_subdomain"
       AND s."contact_id" = NEW."id"
       AND e."workspace_subdomain" = s."workspace_subdomain"
       AND e."student_id" = s."id"
       AND e."deleted_at" IS NULL
       AND e."student_name" IS DISTINCT FROM NEW."name";
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "contacts_sync_enrollment_name" ON "contacts";
--> statement-breakpoint
CREATE TRIGGER "contacts_sync_enrollment_name"
  AFTER UPDATE OF "name" ON "contacts"
  FOR EACH ROW EXECUTE FUNCTION "mms_sync_enrollment_student_name"();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "mms_sync_enrollment_session_name"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."name" IS DISTINCT FROM OLD."name" THEN
    UPDATE "enrollments" e
       SET "session_name" = NEW."name", "updated_at" = now()
     WHERE e."workspace_subdomain" = NEW."workspace_subdomain"
       AND e."session_id" = NEW."id"
       AND e."deleted_at" IS NULL
       AND e."session_name" IS DISTINCT FROM NEW."name";
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "sessions_sync_enrollment_name" ON "sessions";
--> statement-breakpoint
CREATE TRIGGER "sessions_sync_enrollment_name"
  AFTER UPDATE OF "name" ON "sessions"
  FOR EACH ROW EXECUTE FUNCTION "mms_sync_enrollment_session_name"();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "mms_sync_enrollment_class_name"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."name" IS DISTINCT FROM OLD."name" THEN
    UPDATE "enrollments" e
       SET "class_name" = NEW."name", "updated_at" = now()
     WHERE e."workspace_subdomain" = NEW."workspace_subdomain"
       AND e."class_id" = NEW."id"
       AND e."deleted_at" IS NULL
       AND e."class_name" IS DISTINCT FROM NEW."name";
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "session_classes_sync_enrollment_name" ON "session_classes";
--> statement-breakpoint
CREATE TRIGGER "session_classes_sync_enrollment_name"
  AFTER UPDATE OF "name" ON "session_classes"
  FOR EACH ROW EXECUTE FUNCTION "mms_sync_enrollment_class_name"();
--> statement-breakpoint
