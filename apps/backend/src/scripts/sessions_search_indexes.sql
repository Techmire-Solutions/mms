-- Out-of-band ops indexes (NOT a forward migration; large-table index builds are not allowed
-- inside a migration transaction). Run during a maintenance window:
--   psql "$DATABASE_URL" -f apps/backend/src/scripts/sessions_search_indexes.sql
-- The pg_trgm extension is installed by migration 0197.
--
-- Sessions list search uses ILIKE '%term%' over name/description; without trigram indexes those
-- predicates are sequential scans. User-supplied %/_ are escaped by `toEscapedSqlSearchPattern`.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "sessions_name_trgm_idx"
  ON "sessions" USING gin (lower("name") gin_trgm_ops)
  WHERE "deleted_at" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "sessions_description_trgm_idx"
  ON "sessions" USING gin (lower("description") gin_trgm_ops)
  WHERE "deleted_at" IS NULL;
