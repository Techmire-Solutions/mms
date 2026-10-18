-- MMS academic catalogs (migration 0166): FK backing indexes on the large `sessions` table.
-- Run outside a migration transaction:
--   pnpm --filter mms-backend index:concurrent --file src/scripts/academic_catalog_concurrent_indexes.sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "sessions_workspace_category_idx" ON "sessions" ("workspace_subdomain", "category_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "sessions_workspace_program_idx" ON "sessions" ("workspace_subdomain", "program_id");
