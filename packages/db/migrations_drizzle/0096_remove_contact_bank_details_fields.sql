-- Migration 0096: Refactor contact bank details fields
-- 1. Backfill existing iban data into account_number where account_number is empty/null
UPDATE "contact_bank_details"
SET "account_number" = "iban"
WHERE ("account_number" IS NULL OR "account_number" = '')
  AND "iban" IS NOT NULL
  AND "iban" != '';

-- 2. Add account_type column if not exists
ALTER TABLE "contact_bank_details" ADD COLUMN IF NOT EXISTS "account_type" varchar(100);

-- 3. Backfill account_type from legacy label if present
UPDATE "contact_bank_details"
SET "account_type" = "label"
WHERE "account_type" IS NULL AND "label" IS NOT NULL;

-- 4. Drop obsolete columns
ALTER TABLE "contact_bank_details"
  DROP COLUMN IF EXISTS "currency",
  DROP COLUMN IF EXISTS "iban",
  DROP COLUMN IF EXISTS "swift_code",
  DROP COLUMN IF EXISTS "swift_bic",
  DROP COLUMN IF EXISTS "branch_name",
  DROP COLUMN IF EXISTS "branch_code",
  DROP COLUMN IF EXISTS "routing_number",
  DROP COLUMN IF EXISTS "is_primary",
  DROP COLUMN IF EXISTS "account_title",
  DROP COLUMN IF EXISTS "label";

-- 5. Ensure surviving bank columns are nullable
ALTER TABLE "contact_bank_details" ALTER COLUMN "bank_name" DROP NOT NULL;
ALTER TABLE "contact_bank_details" ALTER COLUMN "account_number" DROP NOT NULL;
