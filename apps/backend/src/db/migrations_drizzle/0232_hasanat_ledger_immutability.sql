-- 0232_hasanat_ledger_immutability.sql
-- Forward-only. Turns `hasanat_redemptions` into a genuinely append-only ledger and allows a
-- redemption to be corrected by a reversal row.
--
-- Why
-- ---
--   * `PUT /api/hasanat/redemptions/bulk` could UPDATE an existing ledger row (`points_used`,
--     `reward`, `date`) — the ledger was append-only only by convention.
--   * A card can be reopened only if its redemption stops counting, which must not mean mutating
--     the row. A `reversal` row (unique per redemption) records the correction, and the guard's
--     "one live redemption per card" rule ignores reversed rows.
--   * With reversals, the partial unique index `hasanat_redemp_ws_dist_uidx` (0226) can no longer
--     express the rule; the guard already serializes on the card row, so correctness survives
--     dropping it.
--   * The atomic redeem action gets the same idempotency key as issuance.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

ALTER TABLE "hasanat_redemptions" ADD COLUMN IF NOT EXISTS "kind" varchar(16) NOT NULL DEFAULT 'redeem';
ALTER TABLE "hasanat_redemptions" ADD COLUMN IF NOT EXISTS "reversal_of_id" text;
ALTER TABLE "hasanat_redemptions" ADD COLUMN IF NOT EXISTS "client_request_id" varchar(64);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "hasanat_redemptions" ADD CONSTRAINT "hasanat_redemp_kind_chk"
    CHECK (kind IN ('redeem', 'reversal')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "hasanat_redemptions" ADD CONSTRAINT "hasanat_redemptions_reversal_fk"
    FOREIGN KEY ("workspace_subdomain", "reversal_of_id")
    REFERENCES "hasanat_redemptions" ("workspace_subdomain", "id")
    ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "hasanat_redemp_ws_reversal_uidx"
  ON "hasanat_redemptions" ("workspace_subdomain", "reversal_of_id")
  WHERE "reversal_of_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hasanat_redemp_ws_client_request_uidx"
  ON "hasanat_redemptions" ("workspace_subdomain", "client_request_id")
  WHERE "client_request_id" IS NOT NULL;
--> statement-breakpoint

-- The single-burn index is superseded by the reversal-aware guard below.
DROP INDEX IF EXISTS "hasanat_redemp_ws_dist_uidx";
--> statement-breakpoint

CREATE OR REPLACE FUNCTION hasanat_redemption_guard()
RETURNS TRIGGER AS $$
DECLARE
  v_card_exists boolean;
  v_duplicate boolean;
BEGIN
  -- Serialize on the card row: concurrent redemptions of the same card queue here.
  SELECT true INTO v_card_exists
    FROM hasanat_distributions
   WHERE workspace_subdomain = NEW.workspace_subdomain
     AND id = NEW.distribution_id
   FOR UPDATE;

  IF v_card_exists IS NOT TRUE THEN
    RAISE EXCEPTION 'Hasanat card % does not exist for workspace %', NEW.distribution_id, NEW.workspace_subdomain
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW.kind = 'reversal' THEN
    IF NEW.reversal_of_id IS NULL THEN
      RAISE EXCEPTION 'A reversal requires reversal_of_id' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM hasanat_redemptions r
       WHERE r.workspace_subdomain = NEW.workspace_subdomain
         AND r.id = NEW.reversal_of_id
         AND r.kind = 'redeem'
    ) THEN
      RAISE EXCEPTION 'Hasanat reversal target % is not a redemption', NEW.reversal_of_id
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.reversal_of_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only a reversal row carries reversal_of_id' USING ERRCODE = 'check_violation';
  END IF;

  -- One *live* (not reversed) redemption per card.
  SELECT EXISTS (
    SELECT 1
      FROM hasanat_redemptions r
     WHERE r.workspace_subdomain = NEW.workspace_subdomain
       AND r.distribution_id = NEW.distribution_id
       AND r.kind = 'redeem'
       AND NOT EXISTS (
         SELECT 1 FROM hasanat_redemptions rev
          WHERE rev.workspace_subdomain = r.workspace_subdomain
            AND rev.reversal_of_id = r.id
       )
  ) INTO v_duplicate;

  IF v_duplicate THEN
    RAISE EXCEPTION 'Hasanat card % is already redeemed', NEW.distribution_id
      USING ERRCODE = 'unique_violation', CONSTRAINT = 'hasanat_redemp_live_uidx';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_hasanat_redemptions_guard ON "hasanat_redemptions";
CREATE TRIGGER trg_hasanat_redemptions_guard
  BEFORE INSERT ON "hasanat_redemptions"
  FOR EACH ROW EXECUTE FUNCTION hasanat_redemption_guard();
--> statement-breakpoint

-- Ledger rows are append-only: corrections are reversal rows, never edits.
CREATE OR REPLACE FUNCTION forbid_ledger_update()
RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(current_setting('app.allow_ledger_correction', true), '') = 'true' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Hasanat ledger rows are append-only (table "%"); insert a reversal row instead', TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_hasanat_redemptions_forbid_update ON "hasanat_redemptions";
CREATE TRIGGER trg_hasanat_redemptions_forbid_update
  BEFORE UPDATE ON "hasanat_redemptions"
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_update();
--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "hasanat_redemptions" VALIDATE CONSTRAINT "hasanat_redemp_kind_chk";
  ALTER TABLE "hasanat_redemptions" VALIDATE CONSTRAINT "hasanat_redemptions_reversal_fk";
EXCEPTION WHEN check_violation OR foreign_key_violation THEN
  RAISE NOTICE '0232: ledger constraint left NOT VALID (new rows are still enforced)';
END $$;
