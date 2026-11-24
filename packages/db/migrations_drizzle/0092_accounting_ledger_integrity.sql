-- Phase 1 ledger integrity: fiscal-year FK, source idempotency, journal-line FKs.
-- Expand/contract: new columns are nullable; fiscal_year varchar stays for dual-read.

ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "fiscal_year_id" text;
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "source_type" varchar(20);
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "source_id" varchar(64);

UPDATE "accounting_entries" AS entry
SET "fiscal_year_id" = fiscal.id
FROM "accounting_fiscal_years" AS fiscal
WHERE entry."workspace_subdomain" = fiscal."workspace_subdomain"
  AND entry."fiscal_year_id" IS NULL
  AND entry."fiscal_year" <> ''
  AND fiscal."deleted_at" IS NULL
  AND (
    entry."fiscal_year" = fiscal."id"
    OR entry."fiscal_year" = fiscal."label"
  );

CREATE INDEX IF NOT EXISTS "accounting_entries_workspace_fiscal_id_idx"
  ON "accounting_entries" USING btree ("workspace_subdomain", "fiscal_year_id");

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_entries_workspace_source_uidx"
  ON "accounting_entries" USING btree ("workspace_subdomain", "source_type", "source_id")
  WHERE "source_type" IS NOT NULL AND "source_id" IS NOT NULL AND "deleted_at" IS NULL;

DO $$ BEGIN
  ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_fiscal_year_fk"
    FOREIGN KEY ("workspace_subdomain", "fiscal_year_id")
    REFERENCES "accounting_fiscal_years"("workspace_subdomain", "id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DELETE FROM "accounting_journal_lines" AS line
WHERE NOT EXISTS (
  SELECT 1 FROM "accounting_entries" AS entry
  WHERE entry."workspace_subdomain" = line."workspace_subdomain"
    AND entry."id" = line."entry_id"
);

DELETE FROM "accounting_journal_lines" AS line
WHERE NOT EXISTS (
  SELECT 1 FROM "accounting_accounts" AS account
  WHERE account."workspace_subdomain" = line."workspace_subdomain"
    AND account."id" = line."account_id"
);

DO $$ BEGIN
  ALTER TABLE "accounting_journal_lines" ADD CONSTRAINT "accounting_journal_lines_entry_fk"
    FOREIGN KEY ("workspace_subdomain", "entry_id")
    REFERENCES "accounting_entries"("workspace_subdomain", "id")
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "accounting_journal_lines" ADD CONSTRAINT "accounting_journal_lines_account_fk"
    FOREIGN KEY ("workspace_subdomain", "account_id")
    REFERENCES "accounting_accounts"("workspace_subdomain", "id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "accounting_journal_lines" ADD CONSTRAINT "accounting_journal_lines_nonneg_chk"
    CHECK ("debit" >= 0 AND "credit" >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "accounting_journal_lines" ADD CONSTRAINT "accounting_journal_lines_single_side_chk"
    CHECK ("debit" = 0 OR "credit" = 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
