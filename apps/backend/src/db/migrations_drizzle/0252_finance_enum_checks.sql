-- 0252_finance_enum_checks.sql
-- Forward-only. Pins the account-type and fiscal-year-status vocabularies to the
-- shared enum, and validates the journal-status check that has been NOT VALID.
--
-- Why
-- ---
-- `accounting_accounts.type` and `accounting_fiscal_years.status` were free varchar
-- columns, so a typo or a direct write could store a value the shared Zod enum
-- rejects. The app then either crashes on response validation or mis-classifies a
-- balance (`Asset`/`Expense` are debit-normal). The frontend had a second copy of
-- the account-type list and an inline normal-balance map, so drift was silent.
-- The shared `ACCOUNTING_ACCOUNT_TYPES` / `FISCAL_YEAR_STATUSES` / normal-balance
-- policy are now the SSOT; these checks make the database enforce the same sets.
--
-- `accounting_entries_status_chk` was added NOT VALID; a wrong stored status would
-- reach the ledger reports, so it is validated here.
--
-- Any legacy row outside the enum is listed before the constraint is added, so the
-- migration fails with names instead of a bare constraint error.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

DO $$
DECLARE
  bad_accounts text;
  bad_fiscal_years text;
  bad_entries text;
BEGIN
  SELECT string_agg(format('%s: %s', workspace_subdomain, type), '; ')
    INTO bad_accounts
    FROM accounting_accounts
   WHERE type NOT IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense');

  IF bad_accounts IS NOT NULL THEN
    RAISE EXCEPTION 'accounting_accounts has account types outside the shared enum: %', bad_accounts
      USING HINT = 'Fix those rows to Asset/Liability/Equity/Revenue/Expense, then re-run the migration.';
  END IF;

  SELECT string_agg(format('%s: %s', workspace_subdomain, status), '; ')
    INTO bad_fiscal_years
    FROM accounting_fiscal_years
   WHERE status NOT IN ('active', 'closed', 'upcoming');

  IF bad_fiscal_years IS NOT NULL THEN
    RAISE EXCEPTION 'accounting_fiscal_years has statuses outside the shared enum: %', bad_fiscal_years
      USING HINT = 'Fix those rows to active/closed/upcoming, then re-run the migration.';
  END IF;

  SELECT string_agg(format('%s: %s', workspace_subdomain, status), '; ')
    INTO bad_entries
    FROM accounting_entries
   WHERE status NOT IN ('draft', 'posted');

  IF bad_entries IS NOT NULL THEN
    RAISE EXCEPTION 'accounting_entries has statuses outside the shared enum: %', bad_entries
      USING HINT = 'Fix those rows to draft/posted, then re-run the migration.';
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE accounting_accounts
  ADD CONSTRAINT accounting_accounts_type_chk
  CHECK (type IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')) NOT VALID;
--> statement-breakpoint

ALTER TABLE accounting_accounts VALIDATE CONSTRAINT accounting_accounts_type_chk;
--> statement-breakpoint

ALTER TABLE accounting_fiscal_years
  ADD CONSTRAINT accounting_fiscal_years_status_chk
  CHECK (status IN ('active', 'closed', 'upcoming')) NOT VALID;
--> statement-breakpoint

ALTER TABLE accounting_fiscal_years VALIDATE CONSTRAINT accounting_fiscal_years_status_chk;
--> statement-breakpoint

ALTER TABLE accounting_entries VALIDATE CONSTRAINT accounting_entries_status_chk;
