-- Migration 0108: Soft-delete schema, RLS policies, and triggers
-- 1. Ensure soft-delete column quintuple + deleted_with_cascade across all 19 soft-deletable tables

ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "deletion_reason" VARCHAR(500);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "restored_by" TEXT;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" BOOLEAN DEFAULT false;--> statement-breakpoint

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "deletion_reason" VARCHAR(500);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "restored_by" TEXT;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" BOOLEAN DEFAULT false;--> statement-breakpoint

ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;--> statement-breakpoint
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "deletion_reason" VARCHAR(500);--> statement-breakpoint
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "restored_by" TEXT;--> statement-breakpoint
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" BOOLEAN DEFAULT false;--> statement-breakpoint

ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "deletion_reason" VARCHAR(500);--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "restored_by" TEXT;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" BOOLEAN DEFAULT false;--> statement-breakpoint

ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "deletion_reason" VARCHAR(500);--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "restored_by" TEXT;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" BOOLEAN DEFAULT false;--> statement-breakpoint

ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;--> statement-breakpoint
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "deletion_reason" VARCHAR(500);--> statement-breakpoint
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "restored_by" TEXT;--> statement-breakpoint
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" BOOLEAN DEFAULT false;--> statement-breakpoint

ALTER TABLE "finance_payments" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "finance_payments" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;--> statement-breakpoint
ALTER TABLE "finance_payments" ADD COLUMN IF NOT EXISTS "deletion_reason" VARCHAR(500);--> statement-breakpoint
ALTER TABLE "finance_payments" ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "finance_payments" ADD COLUMN IF NOT EXISTS "restored_by" TEXT;--> statement-breakpoint
ALTER TABLE "finance_payments" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" BOOLEAN DEFAULT false;--> statement-breakpoint

ALTER TABLE "accounting_accounts" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "accounting_accounts" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;--> statement-breakpoint
ALTER TABLE "accounting_accounts" ADD COLUMN IF NOT EXISTS "deletion_reason" VARCHAR(500);--> statement-breakpoint
ALTER TABLE "accounting_accounts" ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "accounting_accounts" ADD COLUMN IF NOT EXISTS "restored_by" TEXT;--> statement-breakpoint
ALTER TABLE "accounting_accounts" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" BOOLEAN DEFAULT false;--> statement-breakpoint

ALTER TABLE "accounting_fiscal_years" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "accounting_fiscal_years" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;--> statement-breakpoint
ALTER TABLE "accounting_fiscal_years" ADD COLUMN IF NOT EXISTS "deletion_reason" VARCHAR(500);--> statement-breakpoint
ALTER TABLE "accounting_fiscal_years" ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "accounting_fiscal_years" ADD COLUMN IF NOT EXISTS "restored_by" TEXT;--> statement-breakpoint
ALTER TABLE "accounting_fiscal_years" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" BOOLEAN DEFAULT false;--> statement-breakpoint

ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "deletion_reason" VARCHAR(500);--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "restored_by" TEXT;--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" BOOLEAN DEFAULT false;--> statement-breakpoint

ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;--> statement-breakpoint
ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "deletion_reason" VARCHAR(500);--> statement-breakpoint
ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "restored_by" TEXT;--> statement-breakpoint
ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" BOOLEAN DEFAULT false;--> statement-breakpoint

ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;--> statement-breakpoint
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "deletion_reason" VARCHAR(500);--> statement-breakpoint
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "restored_by" TEXT;--> statement-breakpoint
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" BOOLEAN DEFAULT false;--> statement-breakpoint

ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "deletion_reason" VARCHAR(500);--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "restored_by" TEXT;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" BOOLEAN DEFAULT false;--> statement-breakpoint

ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "deletion_reason" VARCHAR(500);--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "restored_by" TEXT;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" BOOLEAN DEFAULT false;--> statement-breakpoint

ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "deletion_reason" VARCHAR(500);--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "restored_by" TEXT;--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" BOOLEAN DEFAULT false;--> statement-breakpoint

ALTER TABLE "assessment_results" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "assessment_results" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;--> statement-breakpoint
ALTER TABLE "assessment_results" ADD COLUMN IF NOT EXISTS "deletion_reason" VARCHAR(500);--> statement-breakpoint
ALTER TABLE "assessment_results" ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "assessment_results" ADD COLUMN IF NOT EXISTS "restored_by" TEXT;--> statement-breakpoint
ALTER TABLE "assessment_results" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" BOOLEAN DEFAULT false;--> statement-breakpoint

ALTER TABLE "tenant_users" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD COLUMN IF NOT EXISTS "deletion_reason" VARCHAR(500);--> statement-breakpoint
ALTER TABLE "tenant_users" ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD COLUMN IF NOT EXISTS "restored_by" TEXT;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" BOOLEAN DEFAULT false;--> statement-breakpoint

ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "deletion_reason" VARCHAR(500);--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "restored_by" TEXT;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" BOOLEAN DEFAULT false;--> statement-breakpoint

ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;--> statement-breakpoint
ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "deletion_reason" VARCHAR(500);--> statement-breakpoint
ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE;--> statement-breakpoint
ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "restored_by" TEXT;--> statement-breakpoint
ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" BOOLEAN DEFAULT false;--> statement-breakpoint

-- 2. Schema-level safety guard: BEFORE DELETE trigger function
CREATE OR REPLACE FUNCTION forbid_hard_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.allow_hard_purge', true) = 'true' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Hard delete forbidden on table "%", use soft-delete (UPDATE ... SET deleted_at = NOW()) or set app.allow_hard_purge = true in maintenance transactions.', TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

-- 3. Attach BEFORE DELETE triggers on all soft-deletable entity tables
DROP TRIGGER IF EXISTS trg_contacts_forbid_hard_delete ON "contacts";--> statement-breakpoint
CREATE TRIGGER trg_contacts_forbid_hard_delete
  BEFORE DELETE ON "contacts"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_students_forbid_hard_delete ON "students";--> statement-breakpoint
CREATE TRIGGER trg_students_forbid_hard_delete
  BEFORE DELETE ON "students"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_teachers_forbid_hard_delete ON "teachers";--> statement-breakpoint
CREATE TRIGGER trg_teachers_forbid_hard_delete
  BEFORE DELETE ON "teachers"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_sessions_forbid_hard_delete ON "sessions";--> statement-breakpoint
CREATE TRIGGER trg_sessions_forbid_hard_delete
  BEFORE DELETE ON "sessions"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_enrollments_forbid_hard_delete ON "enrollments";--> statement-breakpoint
CREATE TRIGGER trg_enrollments_forbid_hard_delete
  BEFORE DELETE ON "enrollments"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_finance_invoices_forbid_hard_delete ON "finance_invoices";--> statement-breakpoint
CREATE TRIGGER trg_finance_invoices_forbid_hard_delete
  BEFORE DELETE ON "finance_invoices"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_finance_payments_forbid_hard_delete ON "finance_payments";--> statement-breakpoint
CREATE TRIGGER trg_finance_payments_forbid_hard_delete
  BEFORE DELETE ON "finance_payments"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_accounting_accounts_forbid_hard_delete ON "accounting_accounts";--> statement-breakpoint
CREATE TRIGGER trg_accounting_accounts_forbid_hard_delete
  BEFORE DELETE ON "accounting_accounts"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_accounting_fiscal_years_forbid_hard_delete ON "accounting_fiscal_years";--> statement-breakpoint
CREATE TRIGGER trg_accounting_fiscal_years_forbid_hard_delete
  BEFORE DELETE ON "accounting_fiscal_years"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_accounting_entries_forbid_hard_delete ON "accounting_entries";--> statement-breakpoint
CREATE TRIGGER trg_accounting_entries_forbid_hard_delete
  BEFORE DELETE ON "accounting_entries"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_obligation_collections_forbid_hard_delete ON "obligation_collections";--> statement-breakpoint
CREATE TRIGGER trg_obligation_collections_forbid_hard_delete
  BEFORE DELETE ON "obligation_collections"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_hasanat_distributions_forbid_hard_delete ON "hasanat_distributions";--> statement-breakpoint
CREATE TRIGGER trg_hasanat_distributions_forbid_hard_delete
  BEFORE DELETE ON "hasanat_distributions"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_exams_forbid_hard_delete ON "exams";--> statement-breakpoint
CREATE TRIGGER trg_exams_forbid_hard_delete
  BEFORE DELETE ON "exams"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_questions_forbid_hard_delete ON "questions";--> statement-breakpoint
CREATE TRIGGER trg_questions_forbid_hard_delete
  BEFORE DELETE ON "questions"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_tests_forbid_hard_delete ON "tests";--> statement-breakpoint
CREATE TRIGGER trg_tests_forbid_hard_delete
  BEFORE DELETE ON "tests"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_assessment_results_forbid_hard_delete ON "assessment_results";--> statement-breakpoint
CREATE TRIGGER trg_assessment_results_forbid_hard_delete
  BEFORE DELETE ON "assessment_results"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_tenant_users_forbid_hard_delete ON "tenant_users";--> statement-breakpoint
CREATE TRIGGER trg_tenant_users_forbid_hard_delete
  BEFORE DELETE ON "tenant_users"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_attendance_forbid_hard_delete ON "attendance";--> statement-breakpoint
CREATE TRIGGER trg_attendance_forbid_hard_delete
  BEFORE DELETE ON "attendance"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_message_logs_forbid_hard_delete ON "message_logs";--> statement-breakpoint
CREATE TRIGGER trg_message_logs_forbid_hard_delete
  BEFORE DELETE ON "message_logs"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();--> statement-breakpoint

-- 4. Category B & C partial indexes
CREATE INDEX IF NOT EXISTS "questions_workspace_deleted_records_idx"
  ON "questions" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tests_workspace_deleted_records_idx"
  ON "tests" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "assessment_results_workspace_deleted_records_idx"
  ON "assessment_results" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tenant_users_workspace_deleted_records_idx"
  ON "tenant_users" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tenant_users_workspace_active_idx"
  ON "tenant_users" ("workspace_subdomain")
  WHERE "deleted_at" IS NULL;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_users_workspace_login_email_active_idx"
  ON "tenant_users" ("workspace_subdomain", "login_email")
  WHERE "deleted_at" IS NULL;--> statement-breakpoint

-- Replace existing unique constraints on students(workspace_subdomain, gr_number) with PostgreSQL partial unique index
DROP INDEX IF EXISTS "students_workspace_gr_number_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "students_workspace_gr_number_active_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "students_workspace_gr_number_active_uidx"
  ON "students" ("workspace_subdomain", "gr_number")
  WHERE "deleted_at" IS NULL AND "gr_number" IS NOT NULL;--> statement-breakpoint

-- Replace existing unique constraints on contacts(workspace_subdomain, email) and contacts(workspace_subdomain, phone) with PostgreSQL partial unique indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'email') THEN
    DROP INDEX IF EXISTS "contacts_workspace_email_idx";
    DROP INDEX IF EXISTS "contacts_email_unique";
    CREATE UNIQUE INDEX IF NOT EXISTS "contacts_workspace_email_active_uidx"
      ON "contacts" ("workspace_subdomain", (lower(trim("email"))))
      WHERE "deleted_at" IS NULL AND NULLIF(trim("email"), '') IS NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'phone') THEN
    DROP INDEX IF EXISTS "contacts_workspace_phone_idx";
    DROP INDEX IF EXISTS "contacts_phone_unique";
    CREATE UNIQUE INDEX IF NOT EXISTS "contacts_workspace_phone_active_uidx"
      ON "contacts" ("workspace_subdomain", (regexp_replace("phone", '[^0-9]', '', 'g')))
      WHERE "deleted_at" IS NULL AND NULLIF(regexp_replace("phone", '[^0-9]', '', 'g'), '') IS NOT NULL;
  END IF;
END $$;--> statement-breakpoint

-- 5. Row-Level Security (RLS) policies enforcing default soft-delete isolation
-- Contacts
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contacts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "contacts";--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "contacts";--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "contacts"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = current_setting('app.current_tenant', true)
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

-- Students
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "students" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "students";--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "students";--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "students"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = current_setting('app.current_tenant', true)
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

-- Teachers
ALTER TABLE "teachers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "teachers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "teachers";--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "teachers";--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "teachers"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = current_setting('app.current_tenant', true)
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

-- Sessions
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "sessions";--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "sessions";--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "sessions"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = current_setting('app.current_tenant', true)
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

-- Enrollments
ALTER TABLE "enrollments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "enrollments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "enrollments";--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "enrollments";--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "enrollments"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = current_setting('app.current_tenant', true)
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

-- Finance Invoices
ALTER TABLE "finance_invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "finance_invoices" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "finance_invoices";--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "finance_invoices";--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "finance_invoices"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = current_setting('app.current_tenant', true)
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

-- Finance Payments
ALTER TABLE "finance_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "finance_payments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "finance_payments";--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "finance_payments";--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "finance_payments"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = current_setting('app.current_tenant', true)
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

-- Accounting Accounts
ALTER TABLE "accounting_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "accounting_accounts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "accounting_accounts";--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "accounting_accounts";--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "accounting_accounts"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = current_setting('app.current_tenant', true)
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

-- Accounting Fiscal Years
ALTER TABLE "accounting_fiscal_years" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "accounting_fiscal_years" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "accounting_fiscal_years";--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "accounting_fiscal_years";--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "accounting_fiscal_years"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = current_setting('app.current_tenant', true)
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

-- Accounting Entries
ALTER TABLE "accounting_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "accounting_entries" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "accounting_entries";--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "accounting_entries";--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "accounting_entries"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = current_setting('app.current_tenant', true)
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

-- Obligation Collections
ALTER TABLE "obligation_collections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "obligation_collections" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "obligation_collections_tenant_isolation" ON "obligation_collections";--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "obligation_collections";--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "obligation_collections";--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "obligation_collections"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = current_setting('app.current_tenant', true)
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

-- Hasanat Distributions
ALTER TABLE "hasanat_distributions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hasanat_distributions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "hasanat_distributions";--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "hasanat_distributions";--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "hasanat_distributions"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = current_setting('app.current_tenant', true)
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

-- Exams
ALTER TABLE "exams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exams" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "exams_tenant_isolation" ON "exams";--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "exams";--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "exams";--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "exams"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = current_setting('app.current_tenant', true)
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

-- Questions
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "questions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "questions";--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "questions";--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "questions"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = current_setting('app.current_tenant', true)
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

-- Tests
ALTER TABLE "tests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tests" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "tests";--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "tests";--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "tests"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = current_setting('app.current_tenant', true)
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

-- Assessment Results
ALTER TABLE "assessment_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "assessment_results" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "assessment_results";--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "assessment_results";--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "assessment_results"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = current_setting('app.current_tenant', true)
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

-- Tenant Users
ALTER TABLE "tenant_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant_users" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "tenant_users";--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "tenant_users";--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "tenant_users"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = current_setting('app.current_tenant', true)
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

-- Attendance
ALTER TABLE "attendance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attendance" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "attendance";--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "attendance";--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "attendance"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = current_setting('app.current_tenant', true)
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );--> statement-breakpoint

-- Message Logs
ALTER TABLE "message_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "message_logs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "message_logs_tenant_isolation" ON "message_logs";--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "message_logs";--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "message_logs";--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "message_logs"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = current_setting('app.current_tenant', true)
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );
