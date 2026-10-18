-- MMS class integrity (migration 0171): index for attendance.section_id (FK + per-section reads).
-- Run outside a migration transaction:
--   pnpm --filter mms-backend index:concurrent --file src/scripts/class_integrity_concurrent_indexes.sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "attendance_workspace_section_idx" ON "attendance" ("workspace_subdomain", "section_id");
