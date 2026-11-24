-- Phase A/B: invoice generation from enrollments (billing period + frequency).

ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "billing_period" varchar(7);
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "enrollment_id" varchar(64);

ALTER TABLE "finance_fee_structures" ADD COLUMN IF NOT EXISTS "frequency" varchar(20) NOT NULL DEFAULT 'monthly';
UPDATE "finance_fee_structures" SET "frequency" = 'monthly' WHERE "frequency" IS NULL OR "frequency" = '';
ALTER TABLE "finance_fee_structures" DROP CONSTRAINT IF EXISTS "finance_fee_structures_frequency_check";
ALTER TABLE "finance_fee_structures" ADD CONSTRAINT "finance_fee_structures_frequency_check"
  CHECK ("frequency" IN ('monthly', 'term', 'once'));

CREATE UNIQUE INDEX IF NOT EXISTS "finance_invoices_workspace_enrollment_period_uidx"
  ON "finance_invoices" USING btree ("workspace_subdomain", "enrollment_id", "billing_period")
  WHERE "deleted_at" IS NULL AND "enrollment_id" IS NOT NULL AND "billing_period" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "finance_invoices_workspace_period_idx"
  ON "finance_invoices" USING btree ("workspace_subdomain", "billing_period")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "finance_invoices_workspace_enrollment_idx"
  ON "finance_invoices" USING btree ("workspace_subdomain", "enrollment_id")
  WHERE "deleted_at" IS NULL;
