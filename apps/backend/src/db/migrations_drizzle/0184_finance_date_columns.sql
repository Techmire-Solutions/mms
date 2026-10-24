-- MMS Forward-only Migration: 0184_finance_date_columns.sql
-- Phase 7, finance half — varchar → date for the calendar-day columns 0172/0173 left behind in
-- accounting, finance, hasanat, obligations and contact profiles (mms-data-layer §8).
--
-- In place, not expand/contract: production holds at most ~2.4k rows per target table
-- (audit:finance-date-columns, 2026-10-24), so each rewrite is milliseconds. Section 0 makes that
-- assumption enforceable rather than assumed:
--   • any target table with 50k+ rows aborts the migration (bounded LIMIT probe, no full scan) —
--     such a database needs the expand/contract path instead (see 0173);
--   • any non-empty value that is not a strict `YYYY-MM-DD` aborts it, as does an empty value in
--     a NOT NULL column. Run `pnpm --filter mms-backend audit:finance-date-columns` first.
-- An impossible calendar day still fails the cast itself, which rolls the whole migration back.
-- Empty strings in nullable columns become NULL. Columns already `date` are skipped (re-runnable).

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

DO $$
DECLARE
  target   record;
  rejects  bigint;
  oversize boolean;
BEGIN
  FOR target IN
    SELECT v.tbl, v.col, v.required
      FROM (VALUES
        ('accounting_fiscal_years',         'start_date',    true),
        ('accounting_fiscal_years',         'end_date',      true),
        ('accounting_posting_periods',      'start_date',    true),
        ('accounting_posting_periods',      'end_date',      true),
        ('accounting_entries',              'date',          true),
        ('accounting_bank_statements',      'period_start',  true),
        ('accounting_bank_statements',      'period_end',    true),
        ('accounting_bank_statement_lines', 'date',          true),
        ('finance_invoices',                'due_date',      true),
        ('finance_invoices',                'paid_date',     false),
        ('finance_payments',                'date',          true),
        ('hasanat_batches',                 'added_date',    true),
        ('hasanat_distributions',           'issued_date',   true),
        ('hasanat_redemptions',             'date',          true),
        ('obligation_collections',          'received_date', true),
        ('contact_experiences',             'start_date',    false),
        ('contact_experiences',             'end_date',      false),
        ('contact_activities',              'date',          true),
        ('contact_attachments',             'date',          true)
      ) AS v(tbl, col, required)
      JOIN information_schema.columns c
        ON c.table_schema = 'public' AND c.table_name = v.tbl AND c.column_name = v.col
     WHERE c.data_type <> 'date'
  LOOP
    -- ── 0. Guards ──────────────────────────────────────────────────────────────────────────────
    EXECUTE format('SELECT (SELECT count(*) FROM (SELECT 1 FROM %I LIMIT 50000) t) >= 50000', target.tbl)
      INTO oversize;
    IF oversize THEN
      RAISE EXCEPTION '0184 aborted: % has 50k+ rows; convert %.% with expand/contract instead',
        target.tbl, target.tbl, target.col;
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM %1$I
        WHERE (btrim(coalesce(%2$I, '''')) <> '''' AND btrim(%2$I) !~ ''^[0-9]{4}-[0-9]{2}-[0-9]{2}$'')
           OR ($1 AND btrim(coalesce(%2$I, '''')) = '''')',
      target.tbl, target.col)
      INTO rejects USING target.required;
    IF rejects > 0 THEN
      RAISE EXCEPTION '0184 aborted: %.% has % value(s) that are not a strict YYYY-MM-DD date — run audit:finance-date-columns',
        target.tbl, target.col, rejects;
    END IF;

    -- ── 1. Convert ─────────────────────────────────────────────────────────────────────────────
    EXECUTE format(
      'ALTER TABLE %1$I ALTER COLUMN %2$I DROP DEFAULT,
         ALTER COLUMN %2$I TYPE date USING NULLIF(btrim(%2$I), '''')::date',
      target.tbl, target.col);
  END LOOP;
END $$;
