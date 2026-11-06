-- MMS Sessions Work-list indexes (review of 2026-11-06).
-- Run outside a migration transaction (mms-schema-migrate §7):
--   pnpm --filter mms-backend index:concurrent --file src/scripts/sessions_concurrent_indexes.sql
--
-- Why two 3-column indexes instead of one (tenant, status, start_date, end_date):
--   * the Work list always filters (workspace_subdomain, status[], deleted_at IS NULL);
--   * start_date is the default sort key, end_date a user-selectable sort key;
--   * a trailing end_date adds no selectivity, it only widens every index tuple.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "sessions_ws_status_start_active_idx"
  ON "sessions" ("workspace_subdomain", "status", "start_date")
  WHERE "deleted_at" IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "sessions_ws_start_end_active_idx"
  ON "sessions" ("workspace_subdomain", "start_date", "end_date")
  WHERE "deleted_at" IS NULL;
