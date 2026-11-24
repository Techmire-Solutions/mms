-- MMS Forward-only Migration: 0246_workshop_waitlist.sql
-- Capacity/waitlist follow-up (docs/workshops-subsystems-audit-2026-11-12.md).
--
--   • workshop_events.waitlist_enabled — opt-in queue. Default false keeps the existing behaviour
--     (a full workshop refuses registration with 409) for every current workshop.
--   • workshop_participants.waitlisted_at — a queued registration is the same participant row with
--     this stamp set; status stays 'registered' until the completion engine runs after promotion.
--   • The partial index is the promotion order (oldest queued first) and keeps every seated query
--     (capacity counts, roster, completion, report) using `waitlisted_at IS NULL`.
--
-- Hand-authored by exception (mms-schema-migrate §2 step 2): `drizzle-kit generate` remains blocked
-- by the pre-existing 0216/0217 snapshot collision. The 0246 snapshot was derived from the 0245
-- snapshot by applying these same definitions, and the journal entry is committed with it.
--
-- Both commands are metadata-only on populated tables (nullable column / constant default), and the
-- CHECK is added NOT VALID before validation so legacy rows are never rewritten.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

ALTER TABLE "workshop_events" ADD COLUMN IF NOT EXISTS "waitlist_enabled" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

ALTER TABLE "workshop_participants" ADD COLUMN IF NOT EXISTS "waitlisted_at" timestamp with time zone;
--> statement-breakpoint

ALTER TABLE "workshop_participants" DROP CONSTRAINT IF EXISTS "workshop_participants_waitlist_check";
--> statement-breakpoint
ALTER TABLE "workshop_participants" ADD CONSTRAINT "workshop_participants_waitlist_check"
  CHECK ("waitlisted_at" IS NULL OR "status" = 'registered') NOT VALID;
--> statement-breakpoint
ALTER TABLE "workshop_participants" VALIDATE CONSTRAINT "workshop_participants_waitlist_check";
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "workshop_participants_workshop_waitlist_idx"
  ON "workshop_participants" ("workspace_subdomain", "workshop_id", "waitlisted_at")
  WHERE "deleted_at" IS NULL AND "waitlisted_at" IS NOT NULL;
