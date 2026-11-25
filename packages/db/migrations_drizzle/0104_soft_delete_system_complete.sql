-- Migration 0104: Soft-delete system completion
-- 1. Enrollments cascade column
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" boolean DEFAULT false;--> statement-breakpoint

-- 2. Dedupe active student_id and employee_id before creating partial unique indexes
UPDATE "students" AS s
SET "student_id" = s."student_id" || '-dup-' || s."id"
FROM (
  SELECT "workspace_subdomain", "student_id", min("id") as keep_id
  FROM "students"
  WHERE "deleted_at" IS NULL AND "student_id" IS NOT NULL AND trim("student_id") <> ''
  GROUP BY "workspace_subdomain", "student_id"
  HAVING count(*) > 1
) AS d
WHERE s."workspace_subdomain" = d."workspace_subdomain"
  AND s."student_id" = d."student_id"
  AND s."id" <> d.keep_id
  AND s."deleted_at" IS NULL;--> statement-breakpoint

UPDATE "teachers" AS t
SET "employee_id" = t."employee_id" || '-dup-' || t."id"
FROM (
  SELECT "workspace_subdomain", "employee_id", min("id") as keep_id
  FROM "teachers"
  WHERE "deleted_at" IS NULL AND "employee_id" IS NOT NULL AND trim("employee_id") <> ''
  GROUP BY "workspace_subdomain", "employee_id"
  HAVING count(*) > 1
) AS d
WHERE t."workspace_subdomain" = d."workspace_subdomain"
  AND t."employee_id" = d."employee_id"
  AND t."id" <> d.keep_id
  AND t."deleted_at" IS NULL;--> statement-breakpoint

-- 3. Partial unique indexes on recyclable natural keys
DROP INDEX IF EXISTS "students_workspace_gr_number_active_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "students_workspace_gr_number_active_uidx"
  ON "students" ("workspace_subdomain", "gr_number")
  WHERE "deleted_at" IS NULL AND "gr_number" IS NOT NULL;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "students_workspace_student_id_active_uidx"
  ON "students" ("workspace_subdomain", "student_id")
  WHERE "deleted_at" IS NULL AND "student_id" IS NOT NULL;--> statement-breakpoint

DROP INDEX IF EXISTS "teachers_workspace_employee_id_active_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "teachers_workspace_employee_id_active_uidx"
  ON "teachers" ("workspace_subdomain", "employee_id")
  WHERE "deleted_at" IS NULL AND "employee_id" IS NOT NULL;--> statement-breakpoint

-- 4. Category B active-record partial indexes
CREATE INDEX IF NOT EXISTS "enrollments_workspace_active_idx"
  ON "enrollments" ("workspace_subdomain")
  WHERE "deleted_at" IS NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "accounting_entries_workspace_active_idx"
  ON "accounting_entries" ("workspace_subdomain")
  WHERE "deleted_at" IS NULL;--> statement-breakpoint

-- 5. Category C archived-record partial indexes for trash browsing
CREATE INDEX IF NOT EXISTS "students_workspace_deleted_records_idx"
  ON "students" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "teachers_workspace_deleted_records_idx"
  ON "teachers" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "contacts_workspace_deleted_records_idx"
  ON "contacts" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "sessions_workspace_deleted_records_idx"
  ON "sessions" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "enrollments_workspace_deleted_records_idx"
  ON "enrollments" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "finance_invoices_workspace_deleted_records_idx"
  ON "finance_invoices" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "finance_payments_workspace_deleted_records_idx"
  ON "finance_payments" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "accounting_accounts_workspace_deleted_records_idx"
  ON "accounting_accounts" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "accounting_fiscal_years_workspace_deleted_records_idx"
  ON "accounting_fiscal_years" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "accounting_entries_workspace_deleted_records_idx"
  ON "accounting_entries" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "obligation_collections_workspace_deleted_records_idx"
  ON "obligation_collections" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "hasanat_dist_workspace_deleted_records_idx"
  ON "hasanat_distributions" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "exams_workspace_deleted_records_idx"
  ON "exams" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "questions_workspace_deleted_records_idx"
  ON "questions" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tests_workspace_deleted_records_idx"
  ON "tests" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "assessment_results_workspace_deleted_records_idx"
  ON "assessment_results" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "message_logs_workspace_deleted_records_idx"
  ON "message_logs" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "attendance_workspace_deleted_records_idx"
  ON "attendance" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

-- 6. Schema-level safety guard: BEFORE DELETE trigger function
CREATE OR REPLACE FUNCTION forbid_hard_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.allow_hard_purge', true) = 'true' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Hard delete forbidden on table "%", use soft-delete (UPDATE ... SET deleted_at = NOW())', TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

-- 7. Attach BEFORE DELETE triggers on soft-deletable entity tables
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

DROP TRIGGER IF EXISTS trg_message_logs_forbid_hard_delete ON "message_logs";--> statement-breakpoint
CREATE TRIGGER trg_message_logs_forbid_hard_delete
  BEFORE DELETE ON "message_logs"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_attendance_forbid_hard_delete ON "attendance";--> statement-breakpoint
CREATE TRIGGER trg_attendance_forbid_hard_delete
  BEFORE DELETE ON "attendance"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
