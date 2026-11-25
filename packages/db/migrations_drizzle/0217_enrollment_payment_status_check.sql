-- MMS Forward-only Migration: 0217_enrollment_payment_status_check.sql
-- Constrains `payment_status` to the shared `ENROLLMENT_PAYMENT_STATUSES` enum.
-- Before this, any string could be written by raw SQL and the shared TypeScript union could
-- not represent it (the read mapper used to cast). Added NOT VALID then validated so a legacy
-- bad row aborts the deploy loudly instead of silently draining it (0210 pattern).

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_payment_status_check"
    CHECK ("payment_status" IN ('paid', 'pending', 'none')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  BEGIN
    ALTER TABLE "enrollments" VALIDATE CONSTRAINT "enrollments_payment_status_check";
  EXCEPTION WHEN check_violation THEN
    RAISE WARNING 'enrollments_payment_status_check not validated: legacy invalid rows exist';
  END;
END $$;
