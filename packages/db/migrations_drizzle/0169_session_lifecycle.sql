-- MMS Forward-only Migration: 0169_session_lifecycle.sql
-- Phase 4 — Session lifecycle: draft → open → in_progress → completed (+ cancelled, archived).
-- Legacy free-text statuses are mapped once; the CHECK constraint then guards the column.
--   active   → in_progress (open when its start date is still in the future)
--   upcoming → open
--   inactive → archived
--   unknown  → draft

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

UPDATE "sessions"
   SET "status" = CASE
     WHEN lower(btrim("status")) IN ('draft', 'open', 'in_progress', 'completed', 'cancelled', 'archived') THEN lower(btrim("status"))
     WHEN lower(btrim("status")) = 'active' THEN
       CASE WHEN (CASE WHEN "start_date" ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])' THEN left("start_date", 10)::date END) > CURRENT_DATE
            THEN 'open' ELSE 'in_progress' END
     WHEN lower(btrim("status")) = 'upcoming' THEN 'open'
     WHEN lower(btrim("status")) = 'inactive' THEN 'archived'
     ELSE 'draft'
   END
 WHERE "status" IS DISTINCT FROM CASE
     WHEN lower(btrim("status")) IN ('draft', 'open', 'in_progress', 'completed', 'cancelled', 'archived') THEN lower(btrim("status"))
     ELSE '__remap__'
   END;
--> statement-breakpoint

ALTER TABLE "sessions" ALTER COLUMN "status" SET DEFAULT 'draft';
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_status_lifecycle_check"
    CHECK ("status" IN ('draft', 'open', 'in_progress', 'completed', 'cancelled', 'archived')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "sessions" VALIDATE CONSTRAINT "sessions_status_lifecycle_check";
