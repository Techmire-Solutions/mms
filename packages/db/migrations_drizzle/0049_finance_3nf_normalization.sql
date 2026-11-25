-- 1. Add typed columns to finance_invoices
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "student_id" varchar(64) NOT NULL DEFAULT '';
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "student_name" varchar(255) NOT NULL DEFAULT '';
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "class" varchar(120) NOT NULL DEFAULT '';
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "session" varchar(120) NOT NULL DEFAULT '';
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "base_fee" numeric(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "discount_type" varchar(50);
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "discount_value" numeric(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "discount_amt" numeric(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "final_amt" numeric(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'pending';
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "due_date" varchar(10) NOT NULL DEFAULT '';
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "paid_date" varchar(10);
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "method" varchar(50);
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "paid_amt" numeric(12, 2);
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "deleted_by" text;
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "deletion_reason" text;
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 2. Add typed columns to finance_payments
ALTER TABLE "finance_payments" ADD COLUMN IF NOT EXISTS "invoice_id" text NOT NULL DEFAULT '';
ALTER TABLE "finance_payments" ADD COLUMN IF NOT EXISTS "student_id" varchar(64);
ALTER TABLE "finance_payments" ADD COLUMN IF NOT EXISTS "student_name" varchar(255);
ALTER TABLE "finance_payments" ADD COLUMN IF NOT EXISTS "amount" numeric(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE "finance_payments" ADD COLUMN IF NOT EXISTS "date" varchar(10) NOT NULL DEFAULT '';
ALTER TABLE "finance_payments" ADD COLUMN IF NOT EXISTS "method" varchar(50) NOT NULL DEFAULT 'cash';
ALTER TABLE "finance_payments" ADD COLUMN IF NOT EXISTS "received_by_user_id" text;
ALTER TABLE "finance_payments" ADD COLUMN IF NOT EXISTS "received_by" varchar(120);
ALTER TABLE "finance_payments" ADD COLUMN IF NOT EXISTS "note" text NOT NULL DEFAULT '';
ALTER TABLE "finance_payments" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "finance_payments" ADD COLUMN IF NOT EXISTS "deleted_by" text;
ALTER TABLE "finance_payments" ADD COLUMN IF NOT EXISTS "deletion_reason" text;
ALTER TABLE "finance_payments" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 3. Backfill from custom_data
DO $$
BEGIN
  -- Backfill finance_invoices
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'finance_invoices' AND column_name = 'custom_data'
  ) THEN
    UPDATE "finance_invoices" SET
      "student_id" = COALESCE("custom_data"->>'studentId', ''),
      "student_name" = COALESCE("custom_data"->>'studentName', ''),
      "class" = COALESCE("custom_data"->>'class', ''),
      "session" = COALESCE("custom_data"->>'session', ''),
      "base_fee" = COALESCE(("custom_data"->>'baseFee')::numeric, 0),
      "discount_type" = "custom_data"->>'discountType',
      "discount_value" = COALESCE(("custom_data"->>'discountValue')::numeric, 0),
      "discount_amt" = COALESCE(("custom_data"->>'discountAmt')::numeric, 0),
      "final_amt" = COALESCE(("custom_data"->>'finalAmt')::numeric, 0),
      "status" = COALESCE("custom_data"->>'status', 'pending'),
      "due_date" = COALESCE("custom_data"->>'dueDate', ''),
      "paid_date" = "custom_data"->>'paidDate',
      "method" = "custom_data"->>'method',
      "paid_amt" = CASE 
        WHEN ("custom_data"->>'paidAmt') IS NOT NULL AND ("custom_data"->>'paidAmt') != '' 
        THEN ("custom_data"->>'paidAmt')::numeric 
        ELSE NULL 
      END,
      "deleted_at" = CASE 
        WHEN ("custom_data"->>'deletedAt') IS NOT NULL AND ("custom_data"->>'deletedAt') != '' 
        THEN ("custom_data"->>'deletedAt')::timestamp 
        ELSE NULL 
      END,
      "deleted_by" = "custom_data"->>'deletedBy',
      "deletion_reason" = "custom_data"->>'deletionReason'
    WHERE "custom_data" IS NOT NULL;

    DROP INDEX IF EXISTS "finance_invoices_custom_data_gin_idx";
    ALTER TABLE "finance_invoices" DROP COLUMN "custom_data";
  END IF;

  -- Backfill finance_payments
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'finance_payments' AND column_name = 'custom_data'
  ) THEN
    UPDATE "finance_payments" SET
      "invoice_id" = COALESCE("custom_data"->>'invoiceId', ''),
      "student_id" = "custom_data"->>'studentId',
      "student_name" = "custom_data"->>'studentName',
      "amount" = COALESCE(("custom_data"->>'amount')::numeric, 0),
      "date" = COALESCE("custom_data"->>'date', ''),
      "method" = COALESCE("custom_data"->>'method', 'cash'),
      "received_by_user_id" = "custom_data"->>'receivedByUserId',
      "received_by" = "custom_data"->>'receivedBy',
      "note" = COALESCE("custom_data"->>'note', ''),
      "deleted_at" = CASE 
        WHEN ("custom_data"->>'deletedAt') IS NOT NULL AND ("custom_data"->>'deletedAt') != '' 
        THEN ("custom_data"->>'deletedAt')::timestamp 
        ELSE NULL 
      END,
      "deleted_by" = "custom_data"->>'deletedBy',
      "deletion_reason" = "custom_data"->>'deletionReason'
    WHERE "custom_data" IS NOT NULL;

    DROP INDEX IF EXISTS "finance_payments_custom_data_gin_idx";
    ALTER TABLE "finance_payments" DROP COLUMN "custom_data";
  END IF;
END $$;

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS "finance_invoices_workspace_student_idx"
  ON "finance_invoices" ("workspace_subdomain", "student_id");

CREATE INDEX IF NOT EXISTS "finance_invoices_workspace_status_idx"
  ON "finance_invoices" ("workspace_subdomain", "status");

CREATE INDEX IF NOT EXISTS "finance_invoices_workspace_due_date_idx"
  ON "finance_invoices" ("workspace_subdomain", "due_date");

CREATE INDEX IF NOT EXISTS "finance_invoices_workspace_deleted_idx"
  ON "finance_invoices" ("workspace_subdomain", "deleted_at");

CREATE INDEX IF NOT EXISTS "finance_invoices_workspace_active_idx"
  ON "finance_invoices" ("workspace_subdomain")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "finance_payments_workspace_invoice_idx"
  ON "finance_payments" ("workspace_subdomain", "invoice_id");

CREATE INDEX IF NOT EXISTS "finance_payments_workspace_student_idx"
  ON "finance_payments" ("workspace_subdomain", "student_id");

CREATE INDEX IF NOT EXISTS "finance_payments_workspace_date_idx"
  ON "finance_payments" ("workspace_subdomain", "date");

CREATE INDEX IF NOT EXISTS "finance_payments_workspace_deleted_idx"
  ON "finance_payments" ("workspace_subdomain", "deleted_at");

CREATE INDEX IF NOT EXISTS "finance_payments_workspace_active_idx"
  ON "finance_payments" ("workspace_subdomain")
  WHERE "deleted_at" IS NULL;

-- 5. Force RLS
ALTER TABLE "finance_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_invoices" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS finance_invoices_tenant_isolation ON "finance_invoices";
CREATE POLICY finance_invoices_tenant_isolation ON "finance_invoices"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );

ALTER TABLE "finance_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_payments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS finance_payments_tenant_isolation ON "finance_payments";
CREATE POLICY finance_payments_tenant_isolation ON "finance_payments"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );
