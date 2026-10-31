-- Migration 0185: Add an explicit bank account to accounting posting rules.
-- Obligation receipts route their debit to Cash or Bank by payment mode; before
-- this column the bank account was guessed from account codes, which could
-- credit the wrong account. Nullable and additive: posting simply skips when
-- the workspace has not configured the account.

ALTER TABLE "accounting_posting_rules" ADD COLUMN IF NOT EXISTS "bank_account_id" text;

-- Match the existing composite FKs on this table so the account must belong to
-- the same workspace.
SET LOCAL lock_timeout = '2s';
ALTER TABLE "accounting_posting_rules"
  DROP CONSTRAINT IF EXISTS "accounting_posting_rules_bank_account_fk";
ALTER TABLE "accounting_posting_rules"
  ADD CONSTRAINT "accounting_posting_rules_bank_account_fk"
  FOREIGN KEY ("workspace_subdomain", "bank_account_id")
  REFERENCES "accounting_accounts" ("workspace_subdomain", "id");
