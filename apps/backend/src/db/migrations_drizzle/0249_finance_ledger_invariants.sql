-- 0249_finance_ledger_invariants.sql
-- Forward-only. Ledger-control invariants that must hold no matter which writer
-- ran. See docs/finance-ledger-controls-audit-2026-11-12.md.
--
-- Why
-- ---
--   * The double-entry rule (sum(debit) = sum(credit) > 0, at least two
--     single-sided lines) existed only in `prepareJournalEntryForPersist`. The
--     backup restore, the legacy import, the IAS 21 backfill and any future
--     repository caller write lines without that guard, so an unbalanced posted
--     entry could reach the ledger with no error anywhere. A deferred constraint
--     trigger now checks every touched entry at COMMIT — while it is not yet
--     balanced mid-transaction (children are deleted and re-inserted).
--   * A posted entry dated inside a closed posting period is rejected by the same
--     trigger, so the monthly lock survives app-layer bypasses.
--   * Posted entries and their lines had no content-immutability guard at the
--     database. Ledger-affecting columns are now frozen once posted; only the
--     IAS 21 columns may be backfilled in place (091's contract), and the
--     existing maintenance flags (`app.allow_hard_purge`,
--     `app.allow_ledger_maintenance`) keep purge/restore/backfill working.
--   * `func_debit`/`func_credit` are the functional mirror of the ledger amounts
--     (`journalLineFxInsertValues` copies them). The mirror is now a CHECK, so a
--     writer cannot make the ledger and its functional equivalents disagree.
--   * `accounting_posting_periods` gains close attribution: a period lock with no
--     record of who closed it is not auditable.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ── 1. Posted-entry predicate (balance + open posting period) ────────────────
CREATE OR REPLACE FUNCTION accounting_assert_entry_postable(v_ws text, v_entry_id text)
RETURNS void AS $$
DECLARE
  v_status text;
  v_date   date;
  v_source text;
  v_lines  integer;
  v_debit  numeric;
  v_credit numeric;
  v_period text;
BEGIN
  SELECT status, date, source_type INTO v_status, v_date, v_source
    FROM accounting_entries
   WHERE workspace_subdomain = v_ws AND id = v_entry_id;

  -- Deleted in the same transaction (purge) or not posted: nothing to enforce.
  IF v_status IS NULL OR v_status <> 'posted' THEN
    RETURN;
  END IF;

  SELECT count(*), coalesce(sum(debit), 0), coalesce(sum(credit), 0)
    INTO v_lines, v_debit, v_credit
    FROM accounting_journal_lines
   WHERE workspace_subdomain = v_ws AND entry_id = v_entry_id;

  IF v_lines < 2 THEN
    RAISE EXCEPTION 'Posted journal entry % must have at least two lines (has %)',
      v_entry_id, v_lines USING ERRCODE = 'check_violation';
  END IF;
  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'Posted journal entry % is unbalanced: % debit vs % credit',
      v_entry_id, v_debit, v_credit USING ERRCODE = 'check_violation';
  END IF;
  IF v_debit <= 0 THEN
    RAISE EXCEPTION 'Posted journal entry % has a zero total', v_entry_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- The year-end closing entry is dated inside the final period and is written in
  -- the same transaction that closes that period, so it is the one posting that
  -- must be exempt. `source_type` is server-owned (`withServerOwnedSourceKeys`
  -- forces "manual" for client-created entries), so this cannot be self-declared.
  IF v_source = 'closing' THEN
    RETURN;
  END IF;

  SELECT label INTO v_period
    FROM accounting_posting_periods
   WHERE workspace_subdomain = v_ws
     AND status = 'closed'
     AND start_date <= v_date
     AND end_date >= v_date
   LIMIT 1;
  IF v_period IS NOT NULL THEN
    RAISE EXCEPTION 'Journal entry % is dated inside closed posting period %',
      v_entry_id, v_period USING ERRCODE = 'check_violation';
  END IF;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- Fires per touched line, at commit. Covers line inserts/updates/deletes.
CREATE OR REPLACE FUNCTION accounting_journal_lines_balance_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.allow_hard_purge', true) = 'true'
     OR current_setting('app.allow_ledger_maintenance', true) = 'true' THEN
    RETURN NULL;
  END IF;
  PERFORM accounting_assert_entry_postable(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.workspace_subdomain ELSE NEW.workspace_subdomain END,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.entry_id ELSE NEW.entry_id END
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_accounting_journal_lines_balance_guard ON "accounting_journal_lines";
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER trg_accounting_journal_lines_balance_guard
  AFTER INSERT OR UPDATE OR DELETE ON "accounting_journal_lines"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION accounting_journal_lines_balance_guard();
--> statement-breakpoint

-- Fires only on the transition into `posted`, so a no-op save of a legacy posted
-- row cannot abort unrelated work; the audit script reports those rows instead.
CREATE OR REPLACE FUNCTION accounting_entries_posting_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.allow_hard_purge', true) = 'true'
     OR current_setting('app.allow_ledger_maintenance', true) = 'true' THEN
    RETURN NULL;
  END IF;
  IF OLD.status IS DISTINCT FROM 'posted' AND NEW.status = 'posted' THEN
    PERFORM accounting_assert_entry_postable(NEW.workspace_subdomain, NEW.id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_accounting_entries_posting_guard ON "accounting_entries";
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER trg_accounting_entries_posting_guard
  AFTER UPDATE OF status ON "accounting_entries"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION accounting_entries_posting_guard();
--> statement-breakpoint

-- ── 2. Posted content immutability ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION accounting_entries_posted_columns_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.allow_hard_purge', true) = 'true'
     OR current_setting('app.allow_ledger_maintenance', true) = 'true' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'posted' AND (
       NEW.date IS DISTINCT FROM OLD.date
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.fiscal_year_id IS DISTINCT FROM OLD.fiscal_year_id
    OR NEW.source_type IS DISTINCT FROM OLD.source_type
    OR NEW.source_id IS DISTINCT FROM OLD.source_id
  ) THEN
    RAISE EXCEPTION 'Posted journal entry % is immutable — post a reversal instead', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_accounting_entries_posted_columns_guard ON "accounting_entries";
--> statement-breakpoint
CREATE TRIGGER trg_accounting_entries_posted_columns_guard
  BEFORE UPDATE ON "accounting_entries"
  FOR EACH ROW EXECUTE FUNCTION accounting_entries_posted_columns_guard();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION accounting_journal_lines_posted_columns_guard()
RETURNS TRIGGER AS $$
DECLARE
  parent_status text;
BEGIN
  IF current_setting('app.allow_hard_purge', true) = 'true'
     OR current_setting('app.allow_ledger_maintenance', true) = 'true' THEN
    RETURN NEW;
  END IF;

  SELECT status INTO parent_status
    FROM accounting_entries
   WHERE workspace_subdomain = OLD.workspace_subdomain AND id = OLD.entry_id;

  IF parent_status = 'posted' AND (
       NEW.debit IS DISTINCT FROM OLD.debit
    OR NEW.credit IS DISTINCT FROM OLD.credit
    OR NEW.account_id IS DISTINCT FROM OLD.account_id
    OR NEW.entry_id IS DISTINCT FROM OLD.entry_id
  ) THEN
    RAISE EXCEPTION 'Line % of posted journal entry % is immutable — post a reversal instead',
      OLD.id, OLD.entry_id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_accounting_journal_lines_posted_columns_guard ON "accounting_journal_lines";
--> statement-breakpoint
CREATE TRIGGER trg_accounting_journal_lines_posted_columns_guard
  BEFORE UPDATE ON "accounting_journal_lines"
  FOR EACH ROW EXECUTE FUNCTION accounting_journal_lines_posted_columns_guard();
--> statement-breakpoint

-- ── 3. Functional equivalents mirror the ledger amounts ─────────────────────
DO $$ BEGIN
  ALTER TABLE "accounting_journal_lines" ADD CONSTRAINT "accounting_journal_lines_func_debit_mirror_chk"
    CHECK ("func_debit" IS NULL OR "func_debit" = "debit") NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "accounting_journal_lines" ADD CONSTRAINT "accounting_journal_lines_func_credit_mirror_chk"
    CHECK ("func_credit" IS NULL OR "func_credit" = "credit") NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- ── 4. Posting-period close attribution ─────────────────────────────────────
ALTER TABLE "accounting_posting_periods" ADD COLUMN IF NOT EXISTS "closed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "accounting_posting_periods" ADD COLUMN IF NOT EXISTS "closed_by" text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "accounting_posting_periods" ADD CONSTRAINT "accounting_posting_periods_range_chk"
    CHECK ("start_date" <= "end_date") NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- ── 5. Existing data is reported, never blocked by this deploy ──────────────
DO $$
DECLARE
  v_bad bigint;
BEGIN
  SELECT count(*) INTO v_bad
    FROM accounting_entries e
   WHERE e.status = 'posted'
     AND e.deleted_at IS NULL
     AND (
       SELECT count(*) < 2 OR coalesce(sum(l.debit), 0) <> coalesce(sum(l.credit), 0)
         FROM accounting_journal_lines l
        WHERE l.workspace_subdomain = e.workspace_subdomain AND l.entry_id = e.id
     );
  IF v_bad > 0 THEN
    RAISE WARNING '0249: % posted journal entr(y/ies) do not satisfy the double-entry invariant; run audit:ledger-balance', v_bad;
  END IF;
END $$;
