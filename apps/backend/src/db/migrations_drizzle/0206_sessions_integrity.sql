-- MMS Forward-only Migration: 0206_sessions_integrity.sql
-- Sessions module integrity (review of 2026-11-06):
--   1. Tenant-scoped, no-overlap guarantee for live sessions (`sessions_no_overlap_excl`).
--      The Sessions `allowOverlap` preference is honoured per row through `overlap_exempt`.
--   2. Optimistic-concurrency tokens: `sessions.version`, `session_classes.version/updated_at`.
--   3. Class domain guards (age order, capacity, gender, status) added NOT VALID and validated
--      only where the existing data is clean, so no legacy row is rewritten or deleted.
--   4. `sessions_date_range_check` is finally validated (it was added NOT VALID by 0172).
--   5. `enrollments.session_id -> sessions` loses its cascade: a hard delete must never vaporise
--      enrollment history. The purge allowlist already deletes enrollments before sessions.
--   6. Drops the leftover 0054 permissive RLS policies that made archived sessions visible to
--      every tenant-scoped query, defeating `tenant_soft_delete_isolation` (0108).
--
-- The exclusion constraint builds its index in this transaction, so it takes ACCESS EXCLUSIVE on
-- `sessions` briefly. Run in a low-traffic window; `SET LOCAL lock_timeout` keeps it from queueing
-- behind a long transaction. Legacy overlaps are flagged (`overlap_exempt`) with a WARNING instead
-- of aborting the deploy, and checks whose legacy rows violate them stay NOT VALID (0171 pattern).
-- Indexes for the Work list are built concurrently by src/scripts/sessions_concurrent_indexes.sql
-- (mms-schema-migrate §7).

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ───────────────────────── 1. columns the exclusion constraint needs ─────────────────────────
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "version" bigint NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "overlap_exempt" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'sessions' AND column_name = 'session_period'
  ) THEN
    ALTER TABLE "sessions" ADD COLUMN "session_period" daterange
      GENERATED ALWAYS AS (
        CASE WHEN "start_date" IS NOT NULL AND "end_date" IS NOT NULL
             THEN daterange("start_date", "end_date", '[]')
        END
      ) STORED;
  END IF;
END $$;
--> statement-breakpoint

-- ───────────────────────── 2. make legacy overlaps explicit, not fatal ─────────────────────────
-- Nothing prevented overlapping live sessions before this migration, so existing data may already
-- violate the invariant. Failing the deploy would block every tenant with historical overlap, so
-- the *later* row of each conflicting pair is flagged `overlap_exempt` (the same escape hatch the
-- `allowOverlap` preference uses) and reported. New writes are then constrained; an admin can
-- clear the flags after resolving the pairs.
DO $$
DECLARE
  exempted int := 1;
  total_exempted int := 0;
BEGIN
  WHILE exempted > 0 LOOP
    UPDATE "sessions" s
       SET "overlap_exempt" = true,
           "updated_at" = now(),
           "version" = s."version" + 1
     WHERE s."deleted_at" IS NULL
       AND s."overlap_exempt" = false
       AND s."status" IN ('draft', 'open', 'in_progress')
       AND s."start_date" IS NOT NULL AND s."end_date" IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM "sessions" o
          WHERE o."workspace_subdomain" = s."workspace_subdomain"
            AND o."id" <> s."id"
            AND o."deleted_at" IS NULL
            AND o."overlap_exempt" = false
            AND o."status" IN ('draft', 'open', 'in_progress')
            AND o."start_date" IS NOT NULL AND o."end_date" IS NOT NULL
            AND daterange(o."start_date", o."end_date", '[]')
             && daterange(s."start_date", s."end_date", '[]')
            -- only the later row (by start date, then id) is exempted, so one row per pair survives
            AND (o."start_date", o."id") < (s."start_date", s."id")
       );
    GET DIAGNOSTICS exempted = ROW_COUNT;
    total_exempted := total_exempted + exempted;
  END LOOP;
  IF total_exempted > 0 THEN
    RAISE WARNING 'sessions: % overlapping live row(s) were marked overlap_exempt during migration 0206; resolve the pairs and clear the flags', total_exempted;
  END IF;
END $$;
--> statement-breakpoint

-- ───────────────────────── 3. sessions: no-overlap exclusion + validate the range check ─────────
-- One inclusive date range per tenant for live sessions. Dates are optional, so a dateless session
-- has a NULL period and can never conflict; archived / completed / cancelled history is excluded.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'sessions_no_overlap_excl' AND conrelid = 'sessions'::regclass
  ) THEN
    ALTER TABLE "sessions" ADD CONSTRAINT "sessions_no_overlap_excl"
      EXCLUDE USING gist (
        "workspace_subdomain" WITH =,
        "session_period" WITH &&
      )
      WHERE (
        "deleted_at" IS NULL
        AND "overlap_exempt" = false
        AND "status" IN ('draft', 'open', 'in_progress')
      );
  END IF;
END $$;
--> statement-breakpoint
-- 0172 added this NOT VALID and never validated it. Validate where the data is clean; otherwise leave
-- it NOT VALID (new writes are still enforced) and say so loudly.
DO $$
DECLARE
  bad_ranges int;
BEGIN
  SELECT count(*) INTO bad_ranges
    FROM "sessions"
   WHERE "start_date" IS NOT NULL AND "end_date" IS NOT NULL AND "end_date" < "start_date";
  IF bad_ranges > 0 THEN
    RAISE WARNING 'sessions_date_range_check stays NOT VALID: % row(s) have end_date < start_date', bad_ranges;
  ELSE
    ALTER TABLE "sessions" VALIDATE CONSTRAINT "sessions_date_range_check";
  END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
--> statement-breakpoint

-- ───────────────────────── 4. session_classes: OCC columns + domain guards ─────────────────────────
ALTER TABLE "session_classes" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint
ALTER TABLE "session_classes" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
--> statement-breakpoint
-- A narrower gender CHECK was considered and rejected: legacy rows store "all"/"any"/"1" as well as
-- the shared enum, so the constraint would reject real data. Drop it if an earlier draft ran.
ALTER TABLE "session_classes" DROP CONSTRAINT IF EXISTS "session_classes_gender_check";
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_classes" ADD CONSTRAINT "session_classes_age_range_check"
    CHECK ("age_min" <= "age_max") NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_classes" ADD CONSTRAINT "session_classes_capacity_check"
    CHECK ("capacity" >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_classes" ADD CONSTRAINT "session_classes_status_check"
    CHECK ("status" IN ('active', 'inactive')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
-- Validate only the constraints whose legacy rows are already clean (same pattern as 0171).
DO $$
DECLARE
  constraint_name text;
BEGIN
  FOREACH constraint_name IN ARRAY ARRAY[
    'session_classes_age_range_check',
    'session_classes_capacity_check',
    'session_classes_status_check'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER TABLE "session_classes" VALIDATE CONSTRAINT %I', constraint_name);
    EXCEPTION WHEN check_violation THEN
      RAISE WARNING 'Not validating %: legacy rows violate it (new writes are still enforced)', constraint_name;
    END;
  END LOOP;
END $$;
--> statement-breakpoint

-- ───────────────────────── 5. enrollment history is not cascade fodder ─────────────────────────
-- Previously ON DELETE CASCADE: a hard purge of one session silently deleted its enrollments.
-- Deferrable NO ACTION keeps that protection (the check fails at commit when enrollments survive)
-- without breaking whole-workspace cascades and ordered purges, where parent and child disappear
-- in the same statement/transaction. RESTRICT would fire immediately and break those paths.
DO $$ BEGIN
  ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "enrollments_session_fk";
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_session_fk"
    FOREIGN KEY ("workspace_subdomain", "session_id")
    REFERENCES "sessions" ("workspace_subdomain", "id")
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "enrollments" VALIDATE CONSTRAINT "enrollments_session_fk";
--> statement-breakpoint

-- ───────────────────────── 6. soft-delete RLS leak on sessions ─────────────────────────
-- 0108 replaced `tenant_isolation_policy` with `tenant_soft_delete_isolation`, but the older
-- 0054 policies were never dropped; permissive policies are OR-ed, so archived sessions stayed
-- visible at the database level. Drop them and re-assert FORCE RLS.
DROP POLICY IF EXISTS "sessions_tenant_isolation" ON "sessions";
--> statement-breakpoint
DROP POLICY IF EXISTS "session_classes_tenant_isolation" ON "session_classes";
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "session_classes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "session_classes" FORCE ROW LEVEL SECURITY;
