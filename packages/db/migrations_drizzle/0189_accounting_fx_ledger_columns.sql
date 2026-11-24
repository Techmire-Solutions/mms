-- Migration 0189: expand the ledger for IAS 21 dual amounts (expand phase).
-- New columns are nullable or carry constant defaults, so each ADD COLUMN is a
-- metadata-only change; data migration 091 backfills them, and a later contract
-- migration tightens NOT NULL once reads have switched.

SET LOCAL lock_timeout = '2s';

ALTER TABLE "accounting_accounts"
  ADD COLUMN IF NOT EXISTS "is_monetary" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "account_currency" varchar(3),
  ADD COLUMN IF NOT EXISTS "allow_revaluation" boolean NOT NULL DEFAULT true;

ALTER TABLE "accounting_journal_lines"
  ADD COLUMN IF NOT EXISTS "txn_currency" varchar(3),
  ADD COLUMN IF NOT EXISTS "txn_debit" numeric(19, 4),
  ADD COLUMN IF NOT EXISTS "txn_credit" numeric(19, 4),
  ADD COLUMN IF NOT EXISTS "exchange_rate" numeric(20, 10),
  ADD COLUMN IF NOT EXISTS "rate_type" varchar(16),
  ADD COLUMN IF NOT EXISTS "rate_date" varchar(10),
  ADD COLUMN IF NOT EXISTS "func_debit" numeric(19, 4),
  ADD COLUMN IF NOT EXISTS "func_credit" numeric(19, 4);

ALTER TABLE "accounting_opening_balances"
  ADD COLUMN IF NOT EXISTS "txn_currency" varchar(3),
  ADD COLUMN IF NOT EXISTS "txn_debit" numeric(19, 4),
  ADD COLUMN IF NOT EXISTS "txn_credit" numeric(19, 4),
  ADD COLUMN IF NOT EXISTS "exchange_rate" numeric(20, 10),
  ADD COLUMN IF NOT EXISTS "rate_type" varchar(16),
  ADD COLUMN IF NOT EXISTS "rate_date" varchar(10),
  ADD COLUMN IF NOT EXISTS "func_debit" numeric(19, 4),
  ADD COLUMN IF NOT EXISTS "func_credit" numeric(19, 4);

ALTER TABLE "accounting_posting_rules"
  ADD COLUMN IF NOT EXISTS "fx_realized_account_id" text,
  ADD COLUMN IF NOT EXISTS "fx_unrealized_account_id" text,
  ADD COLUMN IF NOT EXISTS "fx_rounding_account_id" text,
  ADD COLUMN IF NOT EXISTS "cta_account_id" text;

-- Guarded so the migration can be re-applied (ADD CONSTRAINT has no IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounting_posting_rules_fx_realized_fk') THEN
    ALTER TABLE "accounting_posting_rules"
      ADD CONSTRAINT "accounting_posting_rules_fx_realized_fk"
      FOREIGN KEY ("workspace_subdomain", "fx_realized_account_id")
      REFERENCES "accounting_accounts"("workspace_subdomain", "id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounting_posting_rules_fx_unrealized_fk') THEN
    ALTER TABLE "accounting_posting_rules"
      ADD CONSTRAINT "accounting_posting_rules_fx_unrealized_fk"
      FOREIGN KEY ("workspace_subdomain", "fx_unrealized_account_id")
      REFERENCES "accounting_accounts"("workspace_subdomain", "id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounting_posting_rules_fx_rounding_fk') THEN
    ALTER TABLE "accounting_posting_rules"
      ADD CONSTRAINT "accounting_posting_rules_fx_rounding_fk"
      FOREIGN KEY ("workspace_subdomain", "fx_rounding_account_id")
      REFERENCES "accounting_accounts"("workspace_subdomain", "id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounting_posting_rules_cta_fk') THEN
    ALTER TABLE "accounting_posting_rules"
      ADD CONSTRAINT "accounting_posting_rules_cta_fk"
      FOREIGN KEY ("workspace_subdomain", "cta_account_id")
      REFERENCES "accounting_accounts"("workspace_subdomain", "id");
  END IF;
END $$;
