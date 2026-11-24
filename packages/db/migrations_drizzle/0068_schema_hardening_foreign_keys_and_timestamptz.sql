-- Forward-only Migration: 0068_schema_hardening_foreign_keys_and_timestamptz
-- Adds DDL composite foreign keys for relational child tables and prunes redundant indexes.

-- SESSIONS MODULE FOREIGN KEYS
DO $$ BEGIN
  ALTER TABLE "session_classes" ADD CONSTRAINT "session_classes_session_fk"
    FOREIGN KEY ("workspace_subdomain", "session_id") REFERENCES "sessions"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "session_timetable" ADD CONSTRAINT "session_timetable_session_fk"
    FOREIGN KEY ("workspace_subdomain", "session_id") REFERENCES "sessions"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "session_discounts" ADD CONSTRAINT "session_discounts_session_fk"
    FOREIGN KEY ("workspace_subdomain", "session_id") REFERENCES "sessions"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "session_budget_expenses" ADD CONSTRAINT "session_budget_expenses_session_fk"
    FOREIGN KEY ("workspace_subdomain", "session_id") REFERENCES "sessions"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "session_budget_incomes" ADD CONSTRAINT "session_budget_incomes_session_fk"
    FOREIGN KEY ("workspace_subdomain", "session_id") REFERENCES "sessions"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "session_events" ADD CONSTRAINT "session_events_session_fk"
    FOREIGN KEY ("workspace_subdomain", "session_id") REFERENCES "sessions"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "session_tabarruk" ADD CONSTRAINT "session_tabarruk_session_fk"
    FOREIGN KEY ("workspace_subdomain", "session_id") REFERENCES "sessions"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FINANCE MODULE FOREIGN KEYS
DO $$ BEGIN
  ALTER TABLE "finance_payments" ADD CONSTRAINT "finance_payments_invoice_fk"
    FOREIGN KEY ("workspace_subdomain", "invoice_id") REFERENCES "finance_invoices"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ATTENDANCE MODULE FOREIGN KEYS
DO $$ BEGIN
  ALTER TABLE "attendance_leaves" ADD CONSTRAINT "attendance_leaves_student_fk"
    FOREIGN KEY ("workspace_subdomain", "student_id") REFERENCES "students"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_fk"
    FOREIGN KEY ("workspace_subdomain", "student_id") REFERENCES "students"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ENROLLMENTS MODULE FOREIGN KEYS
DO $$ BEGIN
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_fk"
    FOREIGN KEY ("workspace_subdomain", "student_id") REFERENCES "students"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_session_fk"
    FOREIGN KEY ("workspace_subdomain", "session_id") REFERENCES "sessions"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "enrollment_timeline_events" ADD CONSTRAINT "enrollment_timeline_events_enrollment_fk"
    FOREIGN KEY ("workspace_subdomain", "enrollment_id") REFERENCES "enrollments"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ACCOUNTING MODULE FOREIGN KEYS
DO $$ BEGIN
  ALTER TABLE "accounting_journal_lines" ADD CONSTRAINT "accounting_journal_lines_entry_fk"
    FOREIGN KEY ("workspace_subdomain", "entry_id") REFERENCES "accounting_entries"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "accounting_journal_lines" ADD CONSTRAINT "accounting_journal_lines_account_fk"
    FOREIGN KEY ("workspace_subdomain", "account_id") REFERENCES "accounting_accounts"("workspace_subdomain", "id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "accounting_entry_tags" ADD CONSTRAINT "accounting_entry_tags_entry_fk"
    FOREIGN KEY ("workspace_subdomain", "entry_id") REFERENCES "accounting_entries"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "accounting_entry_attachments" ADD CONSTRAINT "accounting_entry_attachments_entry_fk"
    FOREIGN KEY ("workspace_subdomain", "entry_id") REFERENCES "accounting_entries"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- EXAMINATIONS MODULE FOREIGN KEYS
DO $$ BEGIN
  ALTER TABLE "exam_classes" ADD CONSTRAINT "exam_classes_exam_fk"
    FOREIGN KEY ("workspace_subdomain", "exam_id") REFERENCES "exams"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_exam_fk"
    FOREIGN KEY ("workspace_subdomain", "exam_id") REFERENCES "exams"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_student_fk"
    FOREIGN KEY ("workspace_subdomain", "student_id") REFERENCES "students"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "question_categories" ADD CONSTRAINT "question_categories_question_fk"
    FOREIGN KEY ("workspace_subdomain", "question_id") REFERENCES "questions"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_fk"
    FOREIGN KEY ("workspace_subdomain", "question_id") REFERENCES "questions"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "question_tags" ADD CONSTRAINT "question_tags_question_fk"
    FOREIGN KEY ("workspace_subdomain", "question_id") REFERENCES "questions"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "question_citations" ADD CONSTRAINT "question_citations_question_fk"
    FOREIGN KEY ("workspace_subdomain", "question_id") REFERENCES "questions"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_test_fk"
    FOREIGN KEY ("workspace_subdomain", "test_id") REFERENCES "tests"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_question_fk"
    FOREIGN KEY ("workspace_subdomain", "question_id") REFERENCES "questions"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "test_sections" ADD CONSTRAINT "test_sections_test_fk"
    FOREIGN KEY ("workspace_subdomain", "test_id") REFERENCES "tests"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "test_section_questions" ADD CONSTRAINT "test_section_questions_question_fk"
    FOREIGN KEY ("workspace_subdomain", "question_id") REFERENCES "questions"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_test_fk"
    FOREIGN KEY ("workspace_subdomain", "test_id") REFERENCES "tests"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_student_fk"
    FOREIGN KEY ("workspace_subdomain", "student_id") REFERENCES "students"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_result_fk"
    FOREIGN KEY ("workspace_subdomain", "result_id") REFERENCES "assessment_results"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_question_fk"
    FOREIGN KEY ("workspace_subdomain", "question_id") REFERENCES "questions"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- OBLIGATIONS MODULE FOREIGN KEYS
DO $$ BEGIN
  ALTER TABLE "mujtahid_reps" ADD CONSTRAINT "mujtahid_reps_mujtahid_fk"
    FOREIGN KEY ("workspace_subdomain", "mujtahid_id") REFERENCES "mujtahids"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "wakala_types" ADD CONSTRAINT "wakala_types_obligation_type_fk"
    FOREIGN KEY ("workspace_subdomain", "obligation_type_id") REFERENCES "obligation_types"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "wakala_types" ADD CONSTRAINT "wakala_types_rep_fk"
    FOREIGN KEY ("workspace_subdomain", "mujtahid_representative_id") REFERENCES "mujtahid_reps"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "obligation_distributions" ADD CONSTRAINT "obligation_distributions_wakala_fk"
    FOREIGN KEY ("workspace_subdomain", "wakala_type_id") REFERENCES "wakala_types"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "obligation_collections" ADD CONSTRAINT "obligation_collections_obligation_type_fk"
    FOREIGN KEY ("workspace_subdomain", "obligation_type_id") REFERENCES "obligation_types"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "obligation_collections" ADD CONSTRAINT "obligation_collections_rep_fk"
    FOREIGN KEY ("workspace_subdomain", "mujtahid_representative_id") REFERENCES "mujtahid_reps"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- HASANAT MODULE FOREIGN KEYS
DO $$ BEGIN
  ALTER TABLE "hasanat_batches" ADD CONSTRAINT "hasanat_batches_denom_fk"
    FOREIGN KEY ("workspace_subdomain", "denomination_id") REFERENCES "hasanat_denoms"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "hasanat_distributions" ADD CONSTRAINT "hasanat_distributions_batch_fk"
    FOREIGN KEY ("workspace_subdomain", "batch_id") REFERENCES "hasanat_batches"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "hasanat_distributions" ADD CONSTRAINT "hasanat_distributions_denom_fk"
    FOREIGN KEY ("workspace_subdomain", "denomination_id") REFERENCES "hasanat_denoms"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "hasanat_distributions" ADD CONSTRAINT "hasanat_distributions_student_fk"
    FOREIGN KEY ("workspace_subdomain", "recipient_student_id") REFERENCES "students"("workspace_subdomain", "id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "hasanat_distributions" ADD CONSTRAINT "hasanat_distributions_teacher_fk"
    FOREIGN KEY ("workspace_subdomain", "recipient_teacher_id") REFERENCES "teachers"("workspace_subdomain", "id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "hasanat_redemptions" ADD CONSTRAINT "hasanat_redemptions_distribution_fk"
    FOREIGN KEY ("workspace_subdomain", "distribution_id") REFERENCES "hasanat_distributions"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DROP REDUNDANT LEADING-COLUMN INDEXES (where primaryKey(workspace_subdomain, ...) already exists)
DROP INDEX IF EXISTS "sessions_workspace_subdomain_idx";
DROP INDEX IF EXISTS "contacts_workspace_subdomain_idx";
DROP INDEX IF EXISTS "students_workspace_subdomain_idx";
DROP INDEX IF EXISTS "teachers_workspace_subdomain_idx";
DROP INDEX IF EXISTS "attendance_workspace_subdomain_idx";
DROP INDEX IF EXISTS "enrollments_workspace_subdomain_idx";
DROP INDEX IF EXISTS "finance_invoices_workspace_subdomain_idx";
DROP INDEX IF EXISTS "accounting_accounts_workspace_subdomain_idx";
DROP INDEX IF EXISTS "accounting_entries_workspace_subdomain_idx";
DROP INDEX IF EXISTS "exams_workspace_subdomain_idx";
DROP INDEX IF EXISTS "questions_workspace_subdomain_idx";
DROP INDEX IF EXISTS "tests_workspace_subdomain_idx";
DROP INDEX IF EXISTS "obligation_types_workspace_subdomain_idx";
DROP INDEX IF EXISTS "mujtahids_workspace_subdomain_idx";
DROP INDEX IF EXISTS "hasanat_denoms_workspace_subdomain_idx";
DROP INDEX IF EXISTS "message_templates_workspace_subdomain_idx";
DROP INDEX IF EXISTS "message_logs_workspace_subdomain_idx";
DROP INDEX IF EXISTS "audit_log_entries_workspace_subdomain_idx";
DROP INDEX IF EXISTS "user_activity_logs_workspace_subdomain_idx";
