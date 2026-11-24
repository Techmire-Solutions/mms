-- Phases 2–4: billing lines, posting rules, period close, opening balances, bank rec.

ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "invoice_number" varchar(40);
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "fee_structure_id" text;
UPDATE "finance_invoices" SET "invoice_number" = "id" WHERE "invoice_number" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "finance_invoices_workspace_number_uidx"
  ON "finance_invoices" USING btree ("workspace_subdomain", "invoice_number")
  WHERE "deleted_at" IS NULL AND "invoice_number" IS NOT NULL;

ALTER TABLE "accounting_fiscal_years" ADD COLUMN IF NOT EXISTS "closed_at" timestamptz;
ALTER TABLE "accounting_fiscal_years" ADD COLUMN IF NOT EXISTS "closed_by" text;

CREATE TABLE IF NOT EXISTS "finance_fee_structures" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "name" varchar(150) NOT NULL,
  "session" varchar(120) NOT NULL DEFAULT '',
  "class_name" varchar(120) NOT NULL DEFAULT '',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "id")
);
CREATE INDEX IF NOT EXISTS "finance_fee_structures_workspace_active_idx"
  ON "finance_fee_structures" USING btree ("workspace_subdomain", "is_active");

CREATE TABLE IF NOT EXISTS "finance_fee_items" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "structure_id" text NOT NULL,
  "name" varchar(150) NOT NULL,
  "income_account_id" text,
  "amount" numeric(12, 2) NOT NULL DEFAULT 0,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "structure_id", "id"),
  CONSTRAINT "finance_fee_items_structure_fk"
    FOREIGN KEY ("workspace_subdomain", "structure_id")
    REFERENCES "finance_fee_structures"("workspace_subdomain", "id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "finance_fee_items_workspace_structure_idx"
  ON "finance_fee_items" USING btree ("workspace_subdomain", "structure_id");

CREATE TABLE IF NOT EXISTS "finance_invoice_lines" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "invoice_id" text NOT NULL,
  "fee_item_id" text,
  "description" varchar(200) NOT NULL DEFAULT '',
  "quantity" numeric(10, 2) NOT NULL DEFAULT 1,
  "amount" numeric(12, 2) NOT NULL DEFAULT 0,
  "discount_amt" numeric(12, 2) NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "invoice_id", "id"),
  CONSTRAINT "finance_invoice_lines_invoice_fk"
    FOREIGN KEY ("workspace_subdomain", "invoice_id")
    REFERENCES "finance_invoices"("workspace_subdomain", "id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "finance_invoice_lines_workspace_invoice_idx"
  ON "finance_invoice_lines" USING btree ("workspace_subdomain", "invoice_id");

CREATE TABLE IF NOT EXISTS "finance_payment_allocations" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "payment_id" text NOT NULL,
  "invoice_id" text NOT NULL,
  "invoice_line_id" text,
  "amount" numeric(12, 2) NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "payment_id", "id"),
  CONSTRAINT "finance_payment_allocations_payment_fk"
    FOREIGN KEY ("workspace_subdomain", "payment_id")
    REFERENCES "finance_payments"("workspace_subdomain", "id") ON DELETE CASCADE,
  CONSTRAINT "finance_payment_allocations_invoice_fk"
    FOREIGN KEY ("workspace_subdomain", "invoice_id")
    REFERENCES "finance_invoices"("workspace_subdomain", "id")
);
CREATE INDEX IF NOT EXISTS "finance_payment_allocations_workspace_payment_idx"
  ON "finance_payment_allocations" USING btree ("workspace_subdomain", "payment_id");
CREATE INDEX IF NOT EXISTS "finance_payment_allocations_workspace_invoice_idx"
  ON "finance_payment_allocations" USING btree ("workspace_subdomain", "invoice_id");

CREATE TABLE IF NOT EXISTS "accounting_posting_rules" (
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "ar_account_id" text,
  "cash_account_id" text,
  "income_account_id" text,
  "discount_account_id" text,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain")
);

CREATE TABLE IF NOT EXISTS "accounting_opening_balances" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "fiscal_year_id" text NOT NULL,
  "account_id" text NOT NULL,
  "debit" numeric(14, 2) NOT NULL DEFAULT 0,
  "credit" numeric(14, 2) NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "fiscal_year_id", "id"),
  CONSTRAINT "accounting_opening_balances_year_fk"
    FOREIGN KEY ("workspace_subdomain", "fiscal_year_id")
    REFERENCES "accounting_fiscal_years"("workspace_subdomain", "id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "accounting_opening_balances_year_account_uidx"
  ON "accounting_opening_balances" USING btree ("workspace_subdomain", "fiscal_year_id", "account_id");
CREATE INDEX IF NOT EXISTS "accounting_opening_balances_workspace_year_idx"
  ON "accounting_opening_balances" USING btree ("workspace_subdomain", "fiscal_year_id");

CREATE TABLE IF NOT EXISTS "accounting_bank_statements" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "account_id" text NOT NULL,
  "period_start" varchar(10) NOT NULL,
  "period_end" varchar(10) NOT NULL,
  "opening_balance" numeric(14, 2) NOT NULL DEFAULT 0,
  "closing_balance" numeric(14, 2) NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "id")
);
CREATE INDEX IF NOT EXISTS "accounting_bank_statements_workspace_account_idx"
  ON "accounting_bank_statements" USING btree ("workspace_subdomain", "account_id");

CREATE TABLE IF NOT EXISTS "accounting_bank_statement_lines" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "statement_id" text NOT NULL,
  "date" varchar(10) NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "amount" numeric(14, 2) NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "statement_id", "id"),
  CONSTRAINT "accounting_bank_statement_lines_statement_fk"
    FOREIGN KEY ("workspace_subdomain", "statement_id")
    REFERENCES "accounting_bank_statements"("workspace_subdomain", "id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "accounting_bank_statement_lines_workspace_statement_idx"
  ON "accounting_bank_statement_lines" USING btree ("workspace_subdomain", "statement_id");

CREATE TABLE IF NOT EXISTS "accounting_bank_reconciliations" (
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "statement_line_id" text NOT NULL,
  "journal_entry_id" text NOT NULL,
  "journal_line_id" text NOT NULL,
  "matched_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "statement_line_id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "accounting_bank_reconciliations_journal_line_uidx"
  ON "accounting_bank_reconciliations" USING btree ("workspace_subdomain", "journal_entry_id", "journal_line_id");

DO $$ BEGIN
  ALTER TABLE "accounting_bank_reconciliations" ADD CONSTRAINT "accounting_bank_reconciliations_entry_fk"
    FOREIGN KEY ("workspace_subdomain", "journal_entry_id")
    REFERENCES "accounting_entries"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'finance_fee_structures',
    'finance_fee_items',
    'finance_invoice_lines',
    'finance_payment_allocations',
    'accounting_posting_rules',
    'accounting_opening_balances',
    'accounting_bank_statements',
    'accounting_bank_statement_lines',
    'accounting_bank_reconciliations'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_policy ON %I FOR ALL USING (current_setting(''app.rls_bypass'', true) = ''on'' OR workspace_subdomain = current_setting(''app.current_tenant'', true))',
      tbl
    );
  END LOOP;
END $$;
