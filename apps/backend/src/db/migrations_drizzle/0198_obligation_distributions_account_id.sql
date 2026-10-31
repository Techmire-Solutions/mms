-- Migration 0198: Add account_id to obligation_distributions for direct general ledger integration.

SET LOCAL lock_timeout = '2s';
ALTER TABLE "obligation_distributions" ADD COLUMN IF NOT EXISTS "account_id" text;
