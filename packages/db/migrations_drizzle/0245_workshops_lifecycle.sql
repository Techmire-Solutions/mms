-- MMS Forward-only Migration: 0245_workshops_lifecycle.sql
-- Workshops domain/lifecycle follow-up (docs/workshops-domain-lifecycle-audit-2026-11-12.md).
--
--   • workshop_events.status — persisted lifecycle intent (`draft | open | completed | cancelled`).
--     `archived` is the existing soft-delete marker; the date-driven product phases
--     (registration open/closed, ongoing, finished) are derived at read time, so no scheduler is
--     needed to keep the state honest.
--   • Existing rows default to `open`: that is exactly the behaviour they have today (registrable
--     subject to deadline/capacity), so the column ships without changing any live workshop.
--
-- Hand-authored by exception (mms-schema-migrate §2 step 2): `drizzle-kit generate` is still
-- blocked by the pre-existing snapshot collision (0216/0217 share a parent). The 0245 snapshot was
-- derived from the 0244 snapshot by applying this same definition, and the journal entry is
-- committed with it.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

ALTER TABLE "workshop_events" ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'open';
--> statement-breakpoint

ALTER TABLE "workshop_events" DROP CONSTRAINT IF EXISTS "workshop_events_status_check";
--> statement-breakpoint
ALTER TABLE "workshop_events" ADD CONSTRAINT "workshop_events_status_check"
  CHECK ("status" IN ('draft', 'open', 'completed', 'cancelled')) NOT VALID;
--> statement-breakpoint
ALTER TABLE "workshop_events" VALIDATE CONSTRAINT "workshop_events_status_check";
