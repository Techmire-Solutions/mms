-- Phase C/D: overdue/late-fee/reminders, family AR party, credit notes.

ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "family_contact_id" varchar(64);
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "late_fee_amt" numeric(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "credited_amt" numeric(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "last_reminded_at" timestamptz;
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "reminder_count" integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "finance_invoices_workspace_family_idx"
  ON "finance_invoices" USING btree ("workspace_subdomain", "family_contact_id")
  WHERE "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "finance_credit_notes" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "invoice_id" text NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "reason" varchar(200) NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "id"),
  CONSTRAINT "finance_credit_notes_invoice_fk"
    FOREIGN KEY ("workspace_subdomain", "invoice_id")
    REFERENCES "finance_invoices"("workspace_subdomain", "id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "finance_credit_notes_workspace_invoice_idx"
  ON "finance_credit_notes" USING btree ("workspace_subdomain", "invoice_id");

DO $$
BEGIN
  ALTER TABLE "finance_credit_notes" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "finance_credit_notes" FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation_policy ON "finance_credit_notes";
  CREATE POLICY tenant_isolation_policy ON "finance_credit_notes"
    FOR ALL USING (
      current_setting('app.rls_bypass', true) = 'on'
      OR workspace_subdomain = current_setting('app.current_tenant', true)
    );
END $$;
