-- MMS Forward-only Migration: 0261_accounting_cash_flow_section.sql
--
-- IAS 7 cash-flow classification per account: an explicit `operating|investing|
-- financing` section, NULL when the section should be inferred from the account's
-- type/subtype (see `cashFlowSectionForAccount`). The CHECK keeps the column within
-- the enum even for raw-SQL writers.
SET LOCAL lock_timeout = '2s';

ALTER TABLE "accounting_accounts" ADD COLUMN "cash_flow_section" varchar(20);
--> statement-breakpoint
ALTER TABLE "accounting_accounts" ADD CONSTRAINT "accounting_accounts_cash_flow_section_chk"
  CHECK ("cash_flow_section" IN ('operating', 'investing', 'financing'));
