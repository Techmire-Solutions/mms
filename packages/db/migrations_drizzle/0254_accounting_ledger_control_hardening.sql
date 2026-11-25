-- 0254_accounting_ledger_control_hardening.sql
-- Forward-only. Domain/ledger controls the application asserts in TypeScript only —
-- see docs/accounting-ledger-controls-audit-2026-11-13.md.
--
-- Why each block exists
-- ---------------------
--   * Double entry was enforced in the functional currency only. A USD entry whose
--     own legs do not balance passes whenever the gap is plugged by a PKR line, and
--     the FX report then shows exposure that never existed. The commit-time guard now
--     balances every non-functional currency's transaction legs. The functional group
--     is skipped (its lines are the balancing side of a mixed entry) and a currency
--     with a missing leg is skipped (pre-IAS 21-backfill rows).
--   * The database could not enforce a closed fiscal year at all: the 0249 guard only
--     knew about monthly posting periods, so a writer that bypassed the application
--     could post into a closed year whose periods were open (or missing). The date is
--     now checked against `accounting_fiscal_years` too.
--   * The `source_type = 'closing'` exemption was unconditional, so any writer could
--     label a row `closing` and post into a closed period/year. It now applies only to
--     the registered closing entry (source_id = a fiscal year that is closed and ends
--     on the entry date) — which is the one write that must land inside the period it
--     closes, and which happens in the same transaction that closes it.
--   * A header/summary account (an account with active children) could carry journal
--     lines. The line is now rejected, and an account that already carries lines
--     cannot be made a parent — otherwise the hierarchy and the ledger disagree and
--     any rollup would count the same balance twice.
--   * `created_by` was writable on a posted voucher, so the preparer attribution could
--     be rewritten by an edit. It is frozen with the other ledger columns.
--   * Reopening a period whose fiscal year is closed is now impossible regardless of
--     the caller: the check moved into the database, next to the row it protects.
--
-- NOT VALID is not used here: these are triggers/functions and CHECK-free. Existing
-- data is reported (block 6), never blocked. `app.allow_hard_purge` /
-- `app.allow_ledger_maintenance` keep the purge, restore and data-migration paths
-- working.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ── 1. Commit-time guard: balance, dual currency, closed year and period ────
CREATE OR REPLACE FUNCTION accounting_assert_entry_postable(v_ws text, v_entry_id text)
RETURNS void AS $$
DECLARE
  v_status        text;
  v_date          date;
  v_source        text;
  v_source_id     text;
  v_lines         integer;
  v_debit         numeric;
  v_credit        numeric;
  v_period        text;
  v_year          text;
  v_currency_count integer;
  v_fx_imbalance  text;
  v_registered_closing boolean := false;
BEGIN
  SELECT status, date, source_type, source_id
    INTO v_status, v_date, v_source, v_source_id
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

  -- IAS 21: a voucher written in ONE transaction currency must balance in that
  -- currency too. Mixed-currency entries are excluded on purpose — a settlement retires
  -- a USD receivable against PKR cash, so its legs belong to different currencies — and
  -- a line with a missing `txn_*` leg predates the backfill. The functional pair above
  -- stays the global invariant.
  IF NOT EXISTS (
    SELECT 1
      FROM accounting_journal_lines
     WHERE workspace_subdomain = v_ws
       AND entry_id = v_entry_id
       AND txn_currency IS NOT NULL
       AND (txn_debit IS NULL OR txn_credit IS NULL)
  ) THEN
    SELECT count(DISTINCT txn_currency) INTO v_currency_count
      FROM accounting_journal_lines
     WHERE workspace_subdomain = v_ws
       AND entry_id = v_entry_id
       AND txn_currency IS NOT NULL;

    IF v_currency_count = 1 THEN
      SELECT format('%s: debit %s vs credit %s',
                    txn_currency, sum(txn_debit), sum(txn_credit))
        INTO v_fx_imbalance
        FROM accounting_journal_lines
       WHERE workspace_subdomain = v_ws
         AND entry_id = v_entry_id
         AND txn_currency IS NOT NULL
       GROUP BY txn_currency
      HAVING sum(txn_debit) IS DISTINCT FROM sum(txn_credit);

      IF v_fx_imbalance IS NOT NULL THEN
        RAISE EXCEPTION 'Posted journal entry % does not balance in its transaction currency: %',
          v_entry_id, v_fx_imbalance USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  -- The only entry allowed to post inside the period/year it closes: the registered
  -- closing entry of a fiscal year that is closed (the close writes it and flips the
  -- status in the same transaction, so both are true at COMMIT).
  IF v_source = 'closing' AND v_source_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
        FROM accounting_fiscal_years fy
       WHERE fy.workspace_subdomain = v_ws
         AND fy.id = v_source_id
         AND fy.status = 'closed'
         AND fy.end_date = v_date
    ) INTO v_registered_closing;
  END IF;

  IF NOT v_registered_closing THEN
    SELECT fy.label INTO v_year
      FROM accounting_fiscal_years fy
     WHERE fy.workspace_subdomain = v_ws
       AND fy.status = 'closed'
       AND fy.start_date <= v_date
       AND fy.end_date >= v_date
     LIMIT 1;
    IF v_year IS NOT NULL THEN
      RAISE EXCEPTION 'Journal entry % is dated inside closed fiscal year %',
        v_entry_id, v_year USING ERRCODE = 'check_violation';
    END IF;

    SELECT p.label INTO v_period
      FROM accounting_posting_periods p
     WHERE p.workspace_subdomain = v_ws
       AND p.status = 'closed'
       AND p.start_date <= v_date
       AND p.end_date >= v_date
     LIMIT 1;
    IF v_period IS NOT NULL THEN
      RAISE EXCEPTION 'Journal entry % is dated inside closed posting period %',
        v_entry_id, v_period USING ERRCODE = 'check_violation';
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- ── 2. A summary/header account cannot carry journal lines ──────────────────
CREATE OR REPLACE FUNCTION accounting_journal_line_summary_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.allow_hard_purge', true) = 'true'
     OR current_setting('app.allow_ledger_maintenance', true) = 'true' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1
      FROM accounting_accounts child
     WHERE child.workspace_subdomain = NEW.workspace_subdomain
       AND child.parent_account_id = NEW.account_id
       AND child.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Account % is a summary account with sub-accounts and cannot carry journal lines',
      NEW.account_id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_accounting_journal_lines_summary_guard ON "accounting_journal_lines";
--> statement-breakpoint
CREATE TRIGGER trg_accounting_journal_lines_summary_guard
  BEFORE INSERT OR UPDATE OF account_id ON "accounting_journal_lines"
  FOR EACH ROW EXECUTE FUNCTION accounting_journal_line_summary_guard();
--> statement-breakpoint

-- ── 3. An account that already carries lines cannot become a parent ─────────
CREATE OR REPLACE FUNCTION accounting_account_hierarchy_guard()
RETURNS TRIGGER AS $$
DECLARE
  v_cursor  text := NEW.parent_account_id;
  v_ancestors integer := 0;
BEGIN
  IF NEW.parent_account_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF current_setting('app.allow_hard_purge', true) = 'true'
     OR current_setting('app.allow_ledger_maintenance', true) = 'true' THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_account_id = NEW.id THEN
    RAISE EXCEPTION 'Account % cannot be its own parent', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Serialize hierarchy writes per workspace: two concurrent reparents could each
  -- read an acyclic tree and together close a loop that neither sees.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('accounting-coa:' || NEW.workspace_subdomain, 0)
  );

  -- A used account becomes a summary account the moment it gains a child, and the
  -- ledger guard then rejects every future line on it. Refuse that inconsistent state
  -- instead of letting the two rules disagree: it is the PARENT that must be unused.
  IF TG_OP = 'UPDATE' AND NEW.parent_account_id IS DISTINCT FROM OLD.parent_account_id THEN
    IF EXISTS (
      SELECT 1
        FROM accounting_journal_lines l
       WHERE l.workspace_subdomain = NEW.workspace_subdomain
         AND l.account_id = NEW.parent_account_id
    ) THEN
      RAISE EXCEPTION 'Account % already carries journal lines and cannot become a parent',
        NEW.parent_account_id USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  WHILE v_cursor IS NOT NULL LOOP
    v_ancestors := v_ancestors + 1;
    IF v_ancestors > 8 THEN
      RAISE EXCEPTION 'Account hierarchy cannot exceed 8 levels (parent chain of %)', NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_cursor = NEW.id THEN
      RAISE EXCEPTION 'Nesting account % under % would create a hierarchy cycle',
        NEW.id, NEW.parent_account_id USING ERRCODE = 'check_violation';
    END IF;
    SELECT parent_account_id INTO v_cursor
      FROM accounting_accounts
     WHERE workspace_subdomain = NEW.workspace_subdomain AND id = v_cursor;
    IF NOT FOUND THEN
      v_cursor := NULL;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- ── 4. Preparer attribution is frozen on a posted voucher ───────────────────
CREATE OR REPLACE FUNCTION accounting_entries_posted_columns_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.allow_hard_purge', true) = 'true'
     OR current_setting('app.allow_ledger_maintenance', true) = 'true' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'posted' AND (
       NEW.date IS DISTINCT FROM OLD.date
    OR NEW.ref IS DISTINCT FROM OLD.ref
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.fiscal_year_id IS DISTINCT FROM OLD.fiscal_year_id
    OR NEW.source_type IS DISTINCT FROM OLD.source_type
    OR NEW.source_id IS DISTINCT FROM OLD.source_id
    OR NEW.reversed_ref IS DISTINCT FROM OLD.reversed_ref
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
  ) THEN
    RAISE EXCEPTION 'Posted journal entry % is immutable — post a reversal instead', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- ── 5. A period of a closed fiscal year cannot be reopened ──────────────────
CREATE OR REPLACE FUNCTION accounting_posting_period_status_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.allow_hard_purge', true) = 'true'
     OR current_setting('app.allow_ledger_maintenance', true) = 'true' THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'open' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF EXISTS (
      SELECT 1
        FROM accounting_fiscal_years fy
       WHERE fy.workspace_subdomain = NEW.workspace_subdomain
         AND fy.id = NEW.fiscal_year_id
         AND fy.status = 'closed'
    ) THEN
      RAISE EXCEPTION 'Cannot reopen posting period % of a closed fiscal year', NEW.label
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_accounting_posting_periods_status_guard ON "accounting_posting_periods";
--> statement-breakpoint
CREATE TRIGGER trg_accounting_posting_periods_status_guard
  BEFORE UPDATE OF status ON "accounting_posting_periods"
  FOR EACH ROW EXECUTE FUNCTION accounting_posting_period_status_guard();
--> statement-breakpoint

-- ── 6. Report existing data, never block this deploy ────────────────────────
DO $$
DECLARE
  v_fx_bad bigint;
  v_summary_lines bigint;
  v_open_in_closed bigint;
BEGIN
  SELECT count(*) INTO v_fx_bad
    FROM accounting_entries e
   WHERE e.status = 'posted'
     AND e.deleted_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM accounting_journal_lines l
        WHERE l.workspace_subdomain = e.workspace_subdomain
          AND l.entry_id = e.id
          AND l.txn_currency IS NOT NULL
          AND (l.txn_debit IS NULL OR l.txn_credit IS NULL)
     )
     AND (
       SELECT count(DISTINCT l.txn_currency)
         FROM accounting_journal_lines l
        WHERE l.workspace_subdomain = e.workspace_subdomain
          AND l.entry_id = e.id
          AND l.txn_currency IS NOT NULL
     ) = 1
     AND EXISTS (
       SELECT 1 FROM accounting_journal_lines l
        WHERE l.workspace_subdomain = e.workspace_subdomain
          AND l.entry_id = e.id
          AND l.txn_currency IS NOT NULL
        GROUP BY l.txn_currency
       HAVING sum(l.txn_debit) IS DISTINCT FROM sum(l.txn_credit)
     );
  IF v_fx_bad > 0 THEN
    RAISE WARNING '0254: % posted entr(y/ies) do not balance in their transaction currency; run audit:ledger-currency-balance', v_fx_bad;
  END IF;

  SELECT count(*) INTO v_summary_lines
    FROM accounting_journal_lines l
   WHERE EXISTS (
     SELECT 1 FROM accounting_accounts child
      WHERE child.workspace_subdomain = l.workspace_subdomain
        AND child.parent_account_id = l.account_id
        AND child.deleted_at IS NULL
   );
  IF v_summary_lines > 0 THEN
    RAISE WARNING '0254: % journal line(s) sit on a summary account; the next write touching those entries will be rejected', v_summary_lines;
  END IF;

  SELECT count(*) INTO v_open_in_closed
    FROM accounting_posting_periods p
    JOIN accounting_fiscal_years fy
      ON fy.workspace_subdomain = p.workspace_subdomain
     AND fy.id = p.fiscal_year_id
   WHERE p.status = 'open' AND fy.status = 'closed';
  IF v_open_in_closed > 0 THEN
    RAISE WARNING '0254: % posting period(s) are open inside a closed fiscal year; reopen is now refused', v_open_in_closed;
  END IF;
END $$;
