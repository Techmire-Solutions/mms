-- MMS Forward-only Migration: 0210_enrollments_integrity.sql
-- Integrity guards for the Enrollments module:
--   1. `status` whitelist — seat accounting is `status NOT IN (released)`, so an
--      unknown status written by a raw import silently holds a seat forever.
--   2. Discount percentage bounded to [0, 100] (students already have this guard).
--   3. Fee columns non-negative (the ledger must never receive a negative fee).
--
-- All three are added NOT VALID and then validated, so legacy rows cannot abort the
-- deploy (migration 0206 pattern). New writes are enforced immediately.
--
-- NOT here: the partial unique indexes (live student/session, section roll number,
-- promoted-from) and the seat-count index. A plain CREATE INDEX on a populated
-- `enrollments` table is a write outage and `CONCURRENTLY` cannot run inside Drizzle's
-- migration transaction; db/migrations/enrollmentIntegrityIndexes.ts provisions them on
-- every boot instead.
--
-- Hand-authored migration (documented exception, mms-schema-migrate §2):
-- `drizzle-kit generate` aborts on the malformed meta/0000 snapshot. meta/0210_..._snapshot.json
-- is 0209's snapshot copied forward with only these three check constraints added.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_status_check"
    CHECK ("status" IN (
      'pending', 'confirmed', 'cancelled', 'completed', 'withdrawn',
      'promoted', 'retained', 'graduated', 'left'
    )) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_discount_pct_range_check"
    CHECK ("discount_pct" >= 0 AND "discount_pct" <= 100) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_fee_non_negative_check"
    CHECK ("base_fee" >= 0 AND "discount_amt" >= 0 AND "final_fee" >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOREACH constraint_name IN ARRAY ARRAY[
    'enrollments_status_check',
    'enrollments_discount_pct_range_check',
    'enrollments_fee_non_negative_check'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER TABLE "enrollments" VALIDATE CONSTRAINT %I', constraint_name);
    EXCEPTION WHEN check_violation THEN
      RAISE WARNING
        'Not validating %: legacy rows violate it (new writes are still enforced)', constraint_name;
    END;
  END LOOP;
END $$;
--> statement-breakpoint
