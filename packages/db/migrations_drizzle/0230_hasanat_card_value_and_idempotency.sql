-- 0230_hasanat_card_value_and_idempotency.sql
-- Forward-only. Makes a card's point value immutable, adds optimistic concurrency, and gives
-- issuance/redemption an idempotency key.
--
-- Why
-- ---
--   * The card value was computed at read time from the **live** denomination row, so editing a
--     denomination retroactively re-priced every historical card and every report total.
--     `points_snapshot` captures the value at issue and is the only source for redemption bounds,
--     reports, metrics and vouchers.
--   * Card edits were read-modify-write across two transactions with no concurrency token
--     (`genericRelationalService.updateById`), so a concurrent redeem + edit could resurrect an
--     `active` card. `version` gives the update path a compare-and-set.
--   * Issuance had no replay guard: a double-click or a client retry created two cards.
--     `client_request_id` is unique per tenant when present.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "points_snapshot" integer NOT NULL DEFAULT 0;
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 0;
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "client_request_id" varchar(64);
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "expires_on" date;
--> statement-breakpoint

-- Backfill the immutable value from the deed that was current at migration time.
UPDATE "hasanat_distributions" d
   SET "points_snapshot" = GREATEST(0, COALESCE(den."points", 0) * d."quantity")
  FROM "hasanat_denoms" den
 WHERE den."workspace_subdomain" = d."workspace_subdomain"
   AND den."id" = d."denomination_id"
   AND d."points_snapshot" = 0;
--> statement-breakpoint

DO $$
DECLARE
  v_unresolved integer;
BEGIN
  SELECT count(*) INTO v_unresolved
    FROM hasanat_distributions
   WHERE points_snapshot = 0;

  IF v_unresolved > 0 THEN
    RAISE NOTICE '0230: % hasanat card(s) have no resolvable denomination and keep points_snapshot = 0; they cannot be redeemed until re-issued', v_unresolved;
  END IF;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "hasanat_distributions" ADD CONSTRAINT "hasanat_dist_points_snapshot_chk"
    CHECK (points_snapshot >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "hasanat_dist_ws_client_request_uidx"
  ON "hasanat_distributions" ("workspace_subdomain", "client_request_id")
  WHERE "client_request_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hasanat_dist_ws_issuer_date_idx"
  ON "hasanat_distributions" ("workspace_subdomain", "issued_by_user_id", "issued_date");
--> statement-breakpoint

-- The stamped value, its idempotency key, and the OCC token are server-owned.
CREATE OR REPLACE FUNCTION hasanat_distribution_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.points_snapshot IS DISTINCT FROM OLD.points_snapshot
       AND COALESCE(current_setting('app.allow_card_value_rewrite', true), '') <> 'true' THEN
      RAISE EXCEPTION 'points_snapshot is immutable (card %)', NEW.id
        USING ERRCODE = 'check_violation', CONSTRAINT = 'hasanat_dist_points_snapshot_immutable';
    END IF;
    IF NEW.client_request_id IS DISTINCT FROM OLD.client_request_id THEN
      RAISE EXCEPTION 'client_request_id is immutable (card %)', NEW.id
        USING ERRCODE = 'check_violation', CONSTRAINT = 'hasanat_dist_client_request_immutable';
    END IF;
    -- Every card change invalidates a stale edit, whatever wrote it.
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_hasanat_distributions_guard ON "hasanat_distributions";
CREATE TRIGGER trg_hasanat_distributions_guard
  BEFORE INSERT OR UPDATE ON "hasanat_distributions"
  FOR EACH ROW EXECUTE FUNCTION hasanat_distribution_guard();
--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "hasanat_distributions" VALIDATE CONSTRAINT "hasanat_dist_points_snapshot_chk";
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE '0230: hasanat_dist_points_snapshot_chk was violated; left NOT VALID';
END $$;
