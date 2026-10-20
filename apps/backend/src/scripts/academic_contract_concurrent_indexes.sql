-- MMS academic contract (release A / 0181 reads `date_on`; release B / 0182 drops the varchar `date`):
-- attendance indexes on `date_on` that replace the varchar ones. Run after deploying 0181 and
-- BEFORE 0182, outside a transaction (after date_columns_concurrent_indexes.sql):
--   pnpm --filter mms-backend index:concurrent --file src/scripts/academic_contract_concurrent_indexes.sql
-- The unique index keeps one mark per student, class and day once the varchar index is dropped;
-- it fails to build if duplicate marks exist (see audit:academic-contract).
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "attendance_workspace_class_student_date_on_uidx" ON "attendance" ("workspace_subdomain", "class_id", "student_id", "date_on") WHERE "deleted_at" IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "attendance_workspace_class_date_on_status_active_idx" ON "attendance" ("workspace_subdomain", "class_id", "date_on", "status") WHERE "deleted_at" IS NULL;
