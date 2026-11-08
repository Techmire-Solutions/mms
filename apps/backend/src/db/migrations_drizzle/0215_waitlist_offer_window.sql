-- MMS Forward-only Migration: 0215_waitlist_offer_window.sql
-- A freed seat only flipped the oldest waitlisted application to `under_review` with a note;
-- nothing recorded when the offer was made or when it should lapse, so a stale offer could sit
-- in the queue forever. These columns give the offer a real window (the scheduler reverts an
-- expired offer to `waitlisted`), and the partial index keeps the expiry sweep cheap.
SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

ALTER TABLE "registration_applications"
  ADD COLUMN IF NOT EXISTS "waitlist_offered_at" timestamp with time zone;
--> statement-breakpoint

ALTER TABLE "registration_applications"
  ADD COLUMN IF NOT EXISTS "waitlist_offer_expires_at" timestamp with time zone;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "registration_applications_waitlist_expiry_idx"
  ON "registration_applications" USING btree ("workspace_subdomain", "waitlist_offer_expires_at")
  WHERE "waitlist_offer_expires_at" IS NOT NULL AND "deleted_at" IS NULL;
--> statement-breakpoint
