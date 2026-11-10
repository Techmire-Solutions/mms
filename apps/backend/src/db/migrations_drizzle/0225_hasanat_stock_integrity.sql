-- 0225_hasanat_stock_integrity.sql
-- Forward-only. Makes `hasanat_batches.remaining` a DB-maintained projection of live distributions.
--
-- Why
-- ---
-- `remaining` was written last-write-wins from the client (`saveBatch`, `bulkSaveBatches`) and was
-- never decremented when a card was issued, so the command-centre `available` metric drifted from
-- issue history and two concurrent issues could both pass the UI's stock check.
--
-- What
-- ----
--   1. One function recomputes `quantity - issued` while holding the batch row lock; the
--      distribution trigger calls it on every insert/update/delete, so concurrent issues on the
--      same batch serialize and the projection can never be stale after a write.
--   2. The batch trigger only owns `remaining` when `quantity` changes (insert or quantity edit),
--      so the projection is never overwritten by a client-supplied value.
--   3. Range/invariant CHECKs are added NOT VALID (new writes are enforced immediately) and only
--      validated where the legacy data already satisfies them. Violations are reported, never
--      silently rewritten.
--   4. A one-shot backfill recomputes every existing batch; over-issued batches are clamped to 0
--      and reported so the tenant can reconcile the issue history.
--
-- Deployment: hasanat tables hold at most ~2.4k rows per tenant (see 0184 header), so this is a
-- short lock.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- 1. Projection function -------------------------------------------------------
CREATE OR REPLACE FUNCTION hasanat_recalc_batch_remaining(p_ws text, p_batch text)
RETURNS void AS $$
DECLARE
  v_quantity integer;
  v_issued integer;
BEGIN
  -- Lock the batch: concurrent issues for the same batch serialize here, and each recompute sees
  -- the other transaction's committed rows.
  SELECT quantity INTO v_quantity
    FROM hasanat_batches
   WHERE workspace_subdomain = p_ws AND id = p_batch
   FOR UPDATE;

  IF NOT FOUND THEN
    -- Batch already removed (workspace purge or denom cascade) — nothing to project.
    RETURN;
  END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO v_issued
    FROM hasanat_distributions
   WHERE workspace_subdomain = p_ws
     AND batch_id = p_batch
     AND deleted_at IS NULL
     AND status <> 'returned';

  -- An over-issue drives `remaining` negative, which the range CHECK rejects: the statement (and
  -- therefore the issuing transaction) aborts instead of corrupting the stock balance.
  UPDATE hasanat_batches
     SET remaining = v_quantity - v_issued,
         updated_at = now()
   WHERE workspace_subdomain = p_ws AND id = p_batch;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION hasanat_distributions_recalc_remaining()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM hasanat_recalc_batch_remaining(OLD.workspace_subdomain, OLD.batch_id);
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.batch_id IS DISTINCT FROM OLD.batch_id THEN
    -- Moving a card between batches touches two stock rows. Lock them in a deterministic order
    -- so two concurrent moves in opposite directions cannot deadlock.
    IF NEW.batch_id < OLD.batch_id THEN
      PERFORM hasanat_recalc_batch_remaining(NEW.workspace_subdomain, NEW.batch_id);
      PERFORM hasanat_recalc_batch_remaining(OLD.workspace_subdomain, OLD.batch_id);
    ELSE
      PERFORM hasanat_recalc_batch_remaining(OLD.workspace_subdomain, OLD.batch_id);
      PERFORM hasanat_recalc_batch_remaining(NEW.workspace_subdomain, NEW.batch_id);
    END IF;
    RETURN NULL;
  END IF;

  PERFORM hasanat_recalc_batch_remaining(NEW.workspace_subdomain, NEW.batch_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_hasanat_distributions_recalc_remaining ON "hasanat_distributions";
CREATE TRIGGER trg_hasanat_distributions_recalc_remaining
  AFTER INSERT OR UPDATE OR DELETE ON "hasanat_distributions"
  FOR EACH ROW EXECUTE FUNCTION hasanat_distributions_recalc_remaining();
--> statement-breakpoint

-- A batch write must never trust a client-supplied `remaining`; the projection wins.
CREATE OR REPLACE FUNCTION hasanat_batches_sync_remaining()
RETURNS TRIGGER AS $$
DECLARE
  v_issued integer;
BEGIN
  SELECT COALESCE(SUM(quantity), 0) INTO v_issued
    FROM hasanat_distributions
   WHERE workspace_subdomain = NEW.workspace_subdomain
     AND batch_id = NEW.id
     AND deleted_at IS NULL
     AND status <> 'returned';

  NEW.remaining := NEW.quantity - v_issued;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_hasanat_batches_sync_remaining ON "hasanat_batches";
CREATE TRIGGER trg_hasanat_batches_sync_remaining
  BEFORE INSERT OR UPDATE OF quantity ON "hasanat_batches"
  FOR EACH ROW EXECUTE FUNCTION hasanat_batches_sync_remaining();
--> statement-breakpoint

-- 2. Invariant CHECKs (NOT VALID: enforced for new writes, legacy rows untouched) ----
DO $$ BEGIN
  ALTER TABLE "hasanat_batches" ADD CONSTRAINT "hasanat_batches_remaining_chk"
    CHECK (remaining >= 0 AND remaining <= quantity) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "hasanat_batches" ADD CONSTRAINT "hasanat_batches_quantity_chk"
    CHECK (quantity > 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "hasanat_denoms" ADD CONSTRAINT "hasanat_denoms_points_chk"
    CHECK (points >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "hasanat_distributions" ADD CONSTRAINT "hasanat_dist_quantity_chk"
    CHECK (quantity > 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "hasanat_distributions" ADD CONSTRAINT "hasanat_dist_status_chk"
    CHECK (status IN ('active', 'redeemed', 'returned')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "hasanat_distributions" ADD CONSTRAINT "hasanat_dist_recipient_type_chk"
    CHECK (recipient_type IN ('student', 'faculty')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "hasanat_distributions" ADD CONSTRAINT "hasanat_dist_recipient_exclusive_chk"
    CHECK (recipient_student_id IS NULL OR recipient_faculty_id IS NULL) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "hasanat_redemptions" ADD CONSTRAINT "hasanat_redemp_points_used_chk"
    CHECK (points_used > 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- 3. Backfill the projection ---------------------------------------------------
-- The backfill sets `remaining` directly; the batch trigger only fires on `quantity`, so the
-- clamp below survives.
DO $$
DECLARE
  v_over_issued integer;
BEGIN
  SELECT count(*) INTO v_over_issued
    FROM hasanat_batches b
   WHERE b.quantity < COALESCE((
           SELECT SUM(d.quantity) FROM hasanat_distributions d
            WHERE d.workspace_subdomain = b.workspace_subdomain
              AND d.batch_id = b.id
              AND d.deleted_at IS NULL
              AND d.status <> 'returned'), 0);

  IF v_over_issued > 0 THEN
    RAISE NOTICE '0225: % hasanat batch(es) are over-issued; remaining clamped to 0 — audit the distribution history', v_over_issued;
  END IF;

  UPDATE hasanat_batches b
     SET remaining = GREATEST(0, b.quantity - COALESCE((
           SELECT SUM(d.quantity) FROM hasanat_distributions d
            WHERE d.workspace_subdomain = b.workspace_subdomain
              AND d.batch_id = b.id
              AND d.deleted_at IS NULL
              AND d.status <> 'returned'), 0)),
         updated_at = now();
END $$;
--> statement-breakpoint

-- 4. Validate what the legacy data actually satisfies --------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('hasanat_batches', 'hasanat_batches_remaining_chk'),
      ('hasanat_batches', 'hasanat_batches_quantity_chk'),
      ('hasanat_denoms', 'hasanat_denoms_points_chk'),
      ('hasanat_distributions', 'hasanat_dist_quantity_chk'),
      ('hasanat_distributions', 'hasanat_dist_status_chk'),
      ('hasanat_distributions', 'hasanat_dist_recipient_type_chk'),
      ('hasanat_distributions', 'hasanat_dist_recipient_exclusive_chk'),
      ('hasanat_redemptions', 'hasanat_redemp_points_used_chk')
    ) AS v(tbl, con)
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', r.tbl, r.con);
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE '0225: % on % has legacy violations; left NOT VALID (new writes are still enforced)', r.con, r.tbl;
    END;
  END LOOP;
END $$;
