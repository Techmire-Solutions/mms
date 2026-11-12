-- 0248_finance_accounting_integrity.sql
-- Forward-only. Finance & Accounting persistence hardening — see
-- docs/finance-accounting-schema-persistence-audit-2026-11-12.md.
--
-- Why each block exists
-- ---------------------
--   * A posted journal entry could be soft-deleted with no trigger stopping it.
--     `forbid_hard_delete` only covers DELETE, so `UPDATE ... SET deleted_at`
--     removed the entry from every report while its lines stayed behind —
--     silently taking the ledger out of balance with no reversal. The
--     transition is now rejected; `app.allow_hard_purge` keeps workspace purge
--     and backup restore working (both already set it).
--   * A posted entry's lines could be rewritten: the bulk save deletes and
--     re-inserts children for every entry in the batch. DELETE of the lines of a
--     posted entry is now rejected. The repository clears children *before* the
--     parent upsert (so a draft→posted save still works) and skips the rewrite
--     entirely for posted entries (`preserveChildren`); INSERT stays allowed
--     because creating a posted entry inserts its lines, and in-place UPDATE
--     stays allowed because the IAS 21 backfill depends on it.
--   * `rate_date` was `varchar(10)` in four tables, so `'2026-2-1'` sorted after
--     `'2026-12-01'` and the "latest on or before" FX lookup could pick the
--     wrong rate. Converted to `date` with the same strict-ISO guard as 0184.
--   * `finance_payment_allocations.amount` was numeric(12,2) while a payment's
--     applied amount is numeric(19,4), so a cross-currency settlement was
--     silently re-rounded and Σ allocations no longer reconciled against
--     `finance_payments.invoice_amount`.
--   * `accounting_journal_lines_covering_idx` existed on operated databases but
--     in no migration, so a fresh database never got it (drizzle-orm 0.45 cannot
--     express INCLUDE, hence raw SQL here; it is not declared in the model).
--   * The constraints are NOT VALID: legacy rows predate the rules (free-text
--     status/source type, pre-0092 sign conventions), but every new write is
--     checked. A later migration may VALIDATE them once the data is clean.
--   * Single-sidedness of the IAS 21 amounts stays an application invariant: a
--     validating CHECK here would hard-fail 091's functional-currency backfill
--     on any legacy row that carried both sides (which 0092 accommodated with
--     NOT VALID for the debit/credit pair). The sign rule is enforced instead.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ── 1. Posted entries cannot be archived ────────────────────────────────────
CREATE OR REPLACE FUNCTION accounting_entry_posted_archive_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.allow_hard_purge', true) = 'true' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'posted' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Posted journal entry % cannot be archived — post a reversal instead', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_accounting_entries_posted_archive_guard ON "accounting_entries";
--> statement-breakpoint
CREATE TRIGGER trg_accounting_entries_posted_archive_guard
  BEFORE UPDATE OF deleted_at ON "accounting_entries"
  FOR EACH ROW EXECUTE FUNCTION accounting_entry_posted_archive_guard();
--> statement-breakpoint

-- ── 2. Lines of a posted entry are immutable ────────────────────────────────
CREATE OR REPLACE FUNCTION accounting_journal_line_posted_guard()
RETURNS TRIGGER AS $$
DECLARE
  parent_status text;
BEGIN
  IF current_setting('app.allow_hard_purge', true) = 'true' THEN
    RETURN OLD;
  END IF;

  SELECT status INTO parent_status
    FROM accounting_entries
   WHERE workspace_subdomain = OLD.workspace_subdomain
     AND id = OLD.entry_id;

  IF parent_status = 'posted' THEN
    RAISE EXCEPTION 'Lines of posted journal entry % are immutable — post a reversal instead', OLD.entry_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- DELETE only, deliberately. The rewrite vector is delete+reinsert (the bulk save
-- path, now skipped for posted entries via `preserveChildren`). An in-place UPDATE
-- of ledger rows is a legitimate maintenance operation — `091_backfill_functional_currency.ts`
-- fills the IAS 21 columns that way — and data migrations are append-only, so a
-- guard that rejected it could not be paired with a flag inside the migration.
-- Content immutability of posted entries remains an application invariant
-- (`assertEntriesMutable`).
DROP TRIGGER IF EXISTS trg_accounting_journal_lines_posted_guard ON "accounting_journal_lines";
--> statement-breakpoint
CREATE TRIGGER trg_accounting_journal_lines_posted_guard
  BEFORE DELETE ON "accounting_journal_lines"
  FOR EACH ROW EXECUTE FUNCTION accounting_journal_line_posted_guard();
--> statement-breakpoint

-- ── 3. varchar(10) → date for the IAS 21 rate date columns ──────────────────
DO $$
DECLARE
  target  record;
  rejects bigint;
BEGIN
  FOR target IN
    SELECT v.tbl, v.col
      FROM (VALUES
        ('accounting_journal_lines',   'rate_date'),
        ('accounting_opening_balances', 'rate_date'),
        ('accounting_exchange_rates',  'rate_date'),
        ('fx_reference_rates',         'rate_date')
      ) AS v(tbl, col)
      JOIN information_schema.columns c
        ON c.table_schema = 'public' AND c.table_name = v.tbl AND c.column_name = v.col
     WHERE c.data_type <> 'date'
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %1$I
        WHERE btrim(coalesce(%2$I, '''')) <> ''''
          AND btrim(%2$I) !~ ''^[0-9]{4}-[0-9]{2}-[0-9]{2}$''',
      target.tbl, target.col)
      INTO rejects;
    IF rejects > 0 THEN
      RAISE EXCEPTION '0248 aborted: %.% has % value(s) that are not a strict YYYY-MM-DD date — run audit:finance-date-columns',
        target.tbl, target.col, rejects;
    END IF;

    EXECUTE format(
      'ALTER TABLE %1$I ALTER COLUMN %2$I DROP DEFAULT,
         ALTER COLUMN %2$I TYPE date USING NULLIF(btrim(%2$I), '''')::date',
      target.tbl, target.col);
  END LOOP;
END $$;
--> statement-breakpoint

-- ── 4. Allocation precision matches the payment it settles ──────────────────
ALTER TABLE "finance_payment_allocations"
  ALTER COLUMN "amount" TYPE numeric(19, 4);
--> statement-breakpoint

-- ── 5. Indexes the ledger lists and aggregates need ─────────────────────────
-- Default journal ordering (`created_at DESC, id`) and the status+date filter.
CREATE INDEX IF NOT EXISTS "accounting_entries_workspace_created_active_idx"
  ON "accounting_entries" USING btree ("workspace_subdomain", "created_at" DESC, "id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_entries_workspace_status_date_active_idx"
  ON "accounting_entries" USING btree ("workspace_subdomain", "status", "date" DESC)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
-- Present on operated databases already; recorded here so a fresh database gets it.
CREATE INDEX IF NOT EXISTS "accounting_journal_lines_covering_idx"
  ON "accounting_journal_lines" USING btree ("workspace_subdomain", "account_id")
  INCLUDE ("debit", "credit");
--> statement-breakpoint

-- ── 6. NOT VALID constraints (new writes only) ──────────────────────────────
DO $$ BEGIN
  ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_status_chk"
    CHECK ("status" IN ('posted', 'draft')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_source_type_chk"
    CHECK ("source_type" IS NULL OR "source_type" IN (
      'manual', 'invoice', 'payment', 'closing', 'reversal', 'opening', 'obligation',
      'fx_reval', 'fx_reval_reversal', 'ias29_restate', 'ias29_reversal',
      'hedge_val', 'hedge_val_rev', 'hedge_settle', 'hedge_reclass'
    )) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "accounting_journal_lines" ADD CONSTRAINT "accounting_journal_lines_txn_sign_chk"
    CHECK (coalesce("txn_debit", 0) >= 0 AND coalesce("txn_credit", 0) >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "accounting_journal_lines" ADD CONSTRAINT "accounting_journal_lines_func_sign_chk"
    CHECK (coalesce("func_debit", 0) >= 0 AND coalesce("func_credit", 0) >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "accounting_opening_balances" ADD CONSTRAINT "accounting_opening_balances_txn_sign_chk"
    CHECK (coalesce("txn_debit", 0) >= 0 AND coalesce("txn_credit", 0) >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "accounting_opening_balances" ADD CONSTRAINT "accounting_opening_balances_func_sign_chk"
    CHECK (coalesce("func_debit", 0) >= 0 AND coalesce("func_credit", 0) >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "finance_invoices" ADD CONSTRAINT "finance_invoices_currency_chk"
    CHECK ("currency" IS NULL OR "currency" ~ '^[A-Z]{3}$') NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "finance_invoices" ADD CONSTRAINT "finance_invoices_billing_period_chk"
    CHECK ("billing_period" IS NULL OR "billing_period" ~ '^[0-9]{4}-[0-9]{2}$') NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "finance_invoices" ADD CONSTRAINT "finance_invoices_status_chk"
    CHECK ("status" IN ('paid', 'pending', 'overdue', 'partial', 'cancelled')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "finance_payments" ADD CONSTRAINT "finance_payments_amount_chk"
    CHECK ("amount" >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "finance_payment_allocations" ADD CONSTRAINT "finance_payment_allocations_amount_chk"
    CHECK ("amount" > 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
