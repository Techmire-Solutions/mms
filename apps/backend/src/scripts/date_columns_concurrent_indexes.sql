-- MMS date columns (migration 0173): indexes for the new `date` columns on large tables.
-- Run after `backfill:date-columns`, outside a migration transaction:
--   pnpm --filter mms-backend index:concurrent --file src/scripts/date_columns_concurrent_indexes.sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "attendance_workspace_class_date_on_active_idx" ON "attendance" ("workspace_subdomain", "class_id", "date_on") WHERE "deleted_at" IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "attendance_workspace_date_on_idx" ON "attendance" ("workspace_subdomain", "date_on");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "enrollments_workspace_enrolled_on_idx" ON "enrollments" ("workspace_subdomain", "enrolled_on");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "students_workspace_registered_on_idx" ON "students" ("workspace_subdomain", "registered_on");
