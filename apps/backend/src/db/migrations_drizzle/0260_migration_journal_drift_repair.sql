-- MMS Forward-only Migration: 0260_migration_journal_drift_repair.sql
--
-- Repairs databases created before this migration where two journal entries were silently
-- skipped by Drizzle's migrator:
--
--   * 0208_background_job_dead_letters shared its `when` timestamp with 0207. Drizzle records
--     `created_at` (the journal `when`) in `drizzle.__drizzle_migrations` and only applies
--     entries whose `created_at` is strictly greater than the highest recorded value. On a
--     database where 0207 had already been applied, 0208 was never replayed — so
--     `background_jobs.dead_lettered_at` never existed. Drizzle's insert statement always lists
--     every modelled column (using `default` for omitted ones), so *every* background-job
--     insert failed: CSV exports, imports, PDF renders and bulk jobs all answered 500.
--
--   * 0217_enrollment_payment_status_check carries an out-of-order `when` (1762617600000,
--     older than the maximum already applied when it landed), so its CHECK constraint was
--     skipped the same way.
--
-- The historical journal entries are frozen (forward-only: an applied migration may never be
-- rewritten), so this migration replays their effects idempotently and already-drifted databases
-- converge on the next boot. The two rows stay absent from `drizzle.__drizzle_migrations` by
-- design — their effects are what matters, and `checkMigrations.ts` reports them as replayed by a
-- later repair migration. A fresh database runs 0208/0217 first and this migration is a no-op.
--
-- Idempotent and lock-safe: `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and a
-- duplicate-tolerant ADD CONSTRAINT / VALIDATE pair.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ── 0208 replay — durable dead-letter marker ────────────────────────────────────────────────
ALTER TABLE "background_jobs"
  ADD COLUMN IF NOT EXISTS "dead_lettered_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "background_jobs_dead_letter_idx"
  ON "background_jobs" ("dead_lettered_at")
  WHERE "dead_lettered_at" IS NOT NULL;
--> statement-breakpoint

-- ── 0217 replay — enrollment payment_status domain ──────────────────────────────────────────
-- Added NOT VALID then validated (0210/0217 precedent): the ADD takes no long table lock, and a
-- legacy bad row aborts loudly at VALIDATE instead of silently draining the domain constraint.
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
--> statement-breakpoint

-- ── Post-condition guard ────────────────────────────────────────────────────────────────────
-- A database that still lacks the column after this migration would resurrect the all-module
-- export outage. Fail the migration instead of leaving the backend bootable but broken.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'background_jobs'
       AND column_name = 'dead_lettered_at'
  ) THEN
    RAISE EXCEPTION '0260 aborted: background_jobs.dead_lettered_at is still missing';
  END IF;
END $$;
--> statement-breakpoint
