-- 0251_fiscal_year_no_overlap.sql
-- Forward-only. Forbids overlapping fiscal years inside one workspace.
--
-- Why
-- ---
-- No write path validated fiscal-year ranges, so two years could overlap. The
-- year-end close sweeps the P&L of `[start_date, end_date]` into retained
-- earnings, so an overlapping pair lets one close absorb another year's surplus;
-- closing the second year then sees a zeroed P&L (the first close sits inside its
-- range) and marks the year closed without a closing entry. Opening balances and
-- every period report inherit the ambiguity.
--
-- The application guard (`assertFiscalYearWritesAllowed`) now returns a readable
-- 422 naming the conflicting year; this exclusion constraint is the last line of
-- defence for any direct or future write path. Adjacent years (end + 1 day) are
-- allowed, and archived (soft-deleted) years are ignored.
--
-- Existing conflicts are reported by name before the constraint is added, so the
-- migration fails with an actionable message instead of a bare constraint error.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

DO $$
DECLARE
  conflicts text;
BEGIN
  SELECT string_agg(
           format(
             '%s: %s [%s..%s] overlaps %s [%s..%s]',
             a.workspace_subdomain,
             a.label,
             a.start_date,
             a.end_date,
             b.label,
             b.start_date,
             b.end_date
           ),
           '; '
         )
    INTO conflicts
    FROM accounting_fiscal_years a
    JOIN accounting_fiscal_years b
      ON a.workspace_subdomain = b.workspace_subdomain
     AND a.id < b.id
     AND a.deleted_at IS NULL
     AND b.deleted_at IS NULL
     AND daterange(a.start_date, a.end_date, '[]') && daterange(b.start_date, b.end_date, '[]');

  IF conflicts IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot add the fiscal-year non-overlap constraint; conflicting pairs: %', conflicts
      USING HINT = 'Adjust or delete one of the overlapping fiscal years, then re-run the migration.';
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE accounting_fiscal_years
  ADD CONSTRAINT accounting_fiscal_years_no_overlap
  EXCLUDE USING gist (
    workspace_subdomain WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (deleted_at IS NULL);
