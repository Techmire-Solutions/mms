-- MMS Forward-only Migration: 0185_workshops_module.sql
-- Phase 11 — gives the reserved workshop tables (0082 / 0177 / 0178) the shape the Workshops
-- module needs before its first application surface ships:
--   • workshop_events start/end/registration deadline are calendar days → `date`
--     (mms-data-layer §8). No route or job has ever written these tables, so the guard below
--     aborts rather than guess a timezone if any timestamp value exists.
--   • created_at / updated_at (+ the standard trigger) on participants and scores.
--   • one score line per (participant, criterion), so score saves are idempotent upserts.
--   • CHECK constraints for statuses, capacity, score range and date order.
-- All four tables are tiny (empty in production), so plain DDL and index builds are instant.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

DO $$
DECLARE
  populated bigint;
BEGIN
  IF (SELECT data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'workshop_events' AND column_name = 'start_date')
     = 'date' THEN
    RETURN;
  END IF;
  SELECT count(*) INTO populated FROM workshop_events
   WHERE start_date IS NOT NULL OR end_date IS NOT NULL OR registration_deadline IS NOT NULL;
  IF populated > 0 THEN
    RAISE EXCEPTION '0185 aborted: % workshop_events row(s) hold timestamp dates; convert them to calendar days by hand first',
      populated;
  END IF;
  ALTER TABLE "workshop_events"
    ALTER COLUMN "start_date" TYPE date USING NULL,
    ALTER COLUMN "end_date" TYPE date USING NULL,
    ALTER COLUMN "registration_deadline" TYPE date USING NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "workshop_participants"
  ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint
ALTER TABLE "workshop_scores"
  ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "update_workshop_participants_updated_at" ON "workshop_participants";
--> statement-breakpoint
CREATE TRIGGER "update_workshop_participants_updated_at" BEFORE UPDATE ON "workshop_participants" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "update_workshop_scores_updated_at" ON "workshop_scores";
--> statement-breakpoint
CREATE TRIGGER "update_workshop_scores_updated_at" BEFORE UPDATE ON "workshop_scores" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "workshop_scores_participant_criterion_uidx"
  ON "workshop_scores" ("workspace_subdomain", "participant_id", "criterion_name");
--> statement-breakpoint

ALTER TABLE "workshop_participants" DROP CONSTRAINT IF EXISTS "workshop_participants_status_check";
--> statement-breakpoint
ALTER TABLE "workshop_participants" ADD CONSTRAINT "workshop_participants_status_check"
  CHECK ("status" IN ('registered', 'attended', 'completed'));
--> statement-breakpoint
ALTER TABLE "workshop_attendance" DROP CONSTRAINT IF EXISTS "workshop_attendance_status_check";
--> statement-breakpoint
ALTER TABLE "workshop_attendance" ADD CONSTRAINT "workshop_attendance_status_check"
  CHECK ("status" IN ('present', 'absent', 'late', 'excused'));
--> statement-breakpoint
ALTER TABLE "workshop_events" DROP CONSTRAINT IF EXISTS "workshop_events_capacity_check";
--> statement-breakpoint
ALTER TABLE "workshop_events" ADD CONSTRAINT "workshop_events_capacity_check"
  CHECK ("capacity" IS NULL OR "capacity" > 0);
--> statement-breakpoint
ALTER TABLE "workshop_events" DROP CONSTRAINT IF EXISTS "workshop_events_dates_check";
--> statement-breakpoint
ALTER TABLE "workshop_events" ADD CONSTRAINT "workshop_events_dates_check"
  CHECK ("start_date" IS NULL OR "end_date" IS NULL OR "end_date" >= "start_date");
--> statement-breakpoint
ALTER TABLE "workshop_events" DROP CONSTRAINT IF EXISTS "workshop_events_fee_check";
--> statement-breakpoint
ALTER TABLE "workshop_events" ADD CONSTRAINT "workshop_events_fee_check"
  CHECK ("fee" IS NULL OR "fee" >= 0);
--> statement-breakpoint
ALTER TABLE "workshop_scores" DROP CONSTRAINT IF EXISTS "workshop_scores_range_check";
--> statement-breakpoint
ALTER TABLE "workshop_scores" ADD CONSTRAINT "workshop_scores_range_check"
  CHECK ("max_score" > 0 AND "score" >= 0 AND "score" <= "max_score");
