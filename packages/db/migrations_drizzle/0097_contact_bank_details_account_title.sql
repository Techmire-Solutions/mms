ALTER TABLE "contact_bank_details" ADD COLUMN IF NOT EXISTS "account_title" varchar(255);
ALTER TABLE "contact_bank_details" DROP COLUMN IF EXISTS "account_type";
