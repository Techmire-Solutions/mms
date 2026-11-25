-- 0231_hasanat_denom_bounds.sql
-- Forward-only. Bounds every deed's point value at the database, after the API starts returning a
-- 400 for out-of-range values (`validateDenomPoints`, `denomRecordSchema`).
--
-- The lower bound stays at 0 for legacy rows: `validateIssuance` refuses to issue a 0-point deed,
-- so such a row is inert rather than destructive. The upper bound protects reports and the
-- redemption bound from a typo (e.g. an extra zero).

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "hasanat_denoms" ADD CONSTRAINT "hasanat_denoms_points_max_chk"
    CHECK (points <= 100000) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "hasanat_denoms" VALIDATE CONSTRAINT "hasanat_denoms_points_max_chk";
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE '0231: hasanat_denoms has a points value above 100000; constraint left NOT VALID (new writes are still enforced)';
END $$;
