-- 0255_hedge_discontinuation_and_currency_lock.sql
-- Forward-only. Two ledger-control gaps in the specialized standards subsystems —
-- see docs/accounting-standards-subsystems-audit-2026-11-13.md.
--
-- Why each block exists
-- ---------------------
--   * `discontinued` is a modelled hedge status (HEDGE_STATUSES, the status column)
--     but no write could ever set it: an active hedge could only be settled, so a
--     relationship that stopped qualifying kept being valued (IFRS 9.6.5.6 had no
--     exit). The discontinuation write records its own valuation row, and the kind
--     CHECK rejected it. The check now accepts 'discontinuation'.
--   * The functional currency could only be changed through a use-case guard
--     (`exchangeRateUseCases`), while `saveCurrencySettings` writes whatever it is
--     given. A restore, script or future route calling the repository could
--     re-denominate the whole ledger retroactively. The database now refuses the
--     change once the books are locked (`locked_at` set, or anything posted), with
--     the maintenance flags the purge/restore paths use.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ── 1. Discontinuation is a legal hedge valuation kind ──────────────────────
DO $$ BEGIN
  ALTER TABLE "accounting_hedge_valuations"
    DROP CONSTRAINT IF EXISTS "accounting_hedge_valuations_kind";
END $$;
--> statement-breakpoint

ALTER TABLE "accounting_hedge_valuations"
  ADD CONSTRAINT "accounting_hedge_valuations_kind"
  CHECK ("kind" IN ('valuation', 'settlement', 'reclassification', 'discontinuation'));
--> statement-breakpoint

-- ── 2. The functional currency cannot be re-denominated after posting ───────
CREATE OR REPLACE FUNCTION accounting_currency_settings_functional_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.allow_hard_purge', true) = 'true'
     OR current_setting('app.allow_ledger_maintenance', true) = 'true' THEN
    RETURN NEW;
  END IF;
  IF NEW.functional_currency IS DISTINCT FROM OLD.functional_currency THEN
    IF OLD.locked_at IS NOT NULL OR EXISTS (
      SELECT 1
        FROM accounting_entries e
       WHERE e.workspace_subdomain = NEW.workspace_subdomain
         AND e.status = 'posted'
    ) THEN
      RAISE EXCEPTION 'The functional currency cannot change once the books are locked'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_accounting_currency_settings_functional_immutable
  ON "accounting_currency_settings";
--> statement-breakpoint
CREATE TRIGGER trg_accounting_currency_settings_functional_immutable
  BEFORE UPDATE OF functional_currency ON "accounting_currency_settings"
  FOR EACH ROW EXECUTE FUNCTION accounting_currency_settings_functional_immutable();
