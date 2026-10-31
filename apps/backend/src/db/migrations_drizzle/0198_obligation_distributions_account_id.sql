-- Migration 0184: Add account_id to obligation_distributions for direct general ledger integration.

ALTER TABLE "obligation_distributions" ADD COLUMN IF NOT EXISTS "account_id" text;
