-- MMS Database Performance Optimization: Concurrent Indexes & Extended Statistics
-- Note: Must be executed outside migration transactions via `pnpm --filter mms-backend tsx src/scripts/create-index-concurrently.ts --file src/scripts/perf_concurrent_indexes_and_stats.sql`

-- 1. BRIN Indexes on monotonically increasing timestamp columns (saves 95%+ index space vs B-tree)
-- Note: audit_trail_events is partitioned; BRIN is attached per-partition, while non-partitioned tables use CREATE INDEX CONCURRENTLY
CREATE INDEX CONCURRENTLY IF NOT EXISTS "message_logs_created_at_brin_idx" ON "message_logs" USING brin ("created_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "attendance_created_at_brin_idx" ON "attendance" USING brin ("created_at");


-- 2. Covering index on accounting journal lines (Index-Only Scan for trial balance / account totals)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "accounting_journal_lines_covering_idx" ON "accounting_journal_lines" ("workspace_subdomain", "account_id") INCLUDE ("debit", "credit");

-- 3. Composite active index on finance invoices (Student billing period report hot path)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "finance_invoices_workspace_student_period_active_idx" ON "finance_invoices" ("workspace_subdomain", "student_id", "billing_period") WHERE "deleted_at" IS NULL;

-- 4. Extended PostgreSQL Statistics for correlated column selectivity estimation
CREATE STATISTICS IF NOT EXISTS "contacts_gender_syed_stat" ON "gender", "is_syed" FROM "contacts";
CREATE STATISTICS IF NOT EXISTS "attendance_class_date_status_stat" ON "class_id", "date", "status" FROM "attendance";
CREATE STATISTICS IF NOT EXISTS "finance_invoices_status_period_stat" ON "status", "billing_period" FROM "finance_invoices";

-- 5. Drop redundant write-blocking duplicate indexes concurrently (B14 consolidation)
DROP INDEX CONCURRENTLY IF EXISTS "contacts_workspace_name_idx";
DROP INDEX CONCURRENTLY IF EXISTS "contacts_workspace_first_name_idx";
DROP INDEX CONCURRENTLY IF EXISTS "contacts_workspace_last_name_idx";
DROP INDEX CONCURRENTLY IF EXISTS "contacts_workspace_gender_idx";
DROP INDEX CONCURRENTLY IF EXISTS "contacts_workspace_gender_active_idx";


-- 6. Examinations reporting hot paths: one covering marks index (analytics CTE, command-centre
--    pass rate, broadsheet fingerprint) and the section-average enrollment composite.
--    Run out of band; see docs/examinations-documents-analytics-audit-2026-11-11-round2.md.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "exam_results_workspace_exam_covering_idx" ON "exam_results" ("workspace_subdomain", "exam_id") INCLUDE ("student_id", "marks_obtained", "grace_marks", "updated_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "enrollments_workspace_class_student_idx" ON "enrollments" ("workspace_subdomain", "class_id", "student_id") WHERE "deleted_at" IS NULL;
