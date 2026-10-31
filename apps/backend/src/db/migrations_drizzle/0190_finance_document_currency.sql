-- Migration 0190: IAS 21 document currency on invoices and payments.
-- Nullable columns without defaults: metadata-only ADD COLUMN on these large
-- tables, no rewrite and no backfill. NULL reads as the functional currency at
-- rate 1, which is exactly what every existing row is.

SET LOCAL lock_timeout = '2s';

ALTER TABLE "finance_invoices"
  ADD COLUMN IF NOT EXISTS "currency" varchar(3),
  ADD COLUMN IF NOT EXISTS "exchange_rate" numeric(20, 10);

ALTER TABLE "finance_payments"
  ADD COLUMN IF NOT EXISTS "currency" varchar(3),
  ADD COLUMN IF NOT EXISTS "exchange_rate" numeric(20, 10),
  ADD COLUMN IF NOT EXISTS "realized_fx" numeric(19, 4),
  ADD COLUMN IF NOT EXISTS "invoice_amount" numeric(19, 4);
