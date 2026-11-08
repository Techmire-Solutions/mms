-- MMS class sections (migration 0167): indexes on the large `enrollments` table.
-- Run outside a migration transaction:
--   pnpm --filter mms-backend index:concurrent --file src/scripts/class_sections_concurrent_indexes.sql
--
-- Canonical provisioner: the app creates these CONCURRENTLY at boot
-- (src/db/migrations/enrollmentIntegrityIndexes.ts, called from applyDrizzleMigrations).
-- This file is the manual fallback; keep names/predicates in step with that helper.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "enrollments_workspace_section_idx" ON "enrollments" ("workspace_subdomain", "section_id") WHERE "deleted_at" IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "enrollments_seat_count_idx" ON "enrollments" ("workspace_subdomain", "session_id", "class_id", "section_id") INCLUDE ("status") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "enrollments_section_roll_no_active_uidx" ON "enrollments" ("workspace_subdomain", "section_id", lower(btrim("roll_no"))) WHERE "deleted_at" IS NULL AND "roll_no" IS NOT NULL AND btrim("roll_no") <> '' AND "status" <> 'cancelled';
