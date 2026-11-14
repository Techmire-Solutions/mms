-- 0258_obligations_indexes_concurrent.sql — run out of band, never inside the migration run.
--
-- `obligation_collections` and `obligation_distributions` are both in `LARGE_TABLES` in
-- scripts/check-migration-indexes.mjs, so a plain CREATE INDEX on them is a write outage; and
-- `CREATE INDEX CONCURRENTLY` cannot be expressed in `migrations_drizzle/*.sql` because Drizzle's
-- migrator wraps every statement of a run in one transaction.
--
-- Usage:
--   pnpm --filter mms-backend exec tsx src/scripts/create-index-concurrently.ts \
--     --file scripts/sql/0258_obligations_indexes_concurrent.sql
--
-- Order matters. The unique index is created LAST: it fails if a tenant already holds duplicate
-- receipt numbers, and a failed CONCURRENTLY build leaves an INVALID index behind that has to be
-- dropped before a retry.

-- ── 1. F9 — drop the superseded plain indexes ───────────────────────────────────────────────
-- The plain (workspace_subdomain, sender_id) index is deliberately KEPT: nothing in the module
-- filters a collection list by donor today, but the referential probe behind
-- `obligation_collections_sender_fk` (RESTRICT) does use it. A (sender_id, received_date DESC)
-- statement index is only worth building once a per-donor statement query exists.
-- `_deleted_idx` duplicates `_deleted_records_idx` (every trash read filters deleted_at IS NOT
-- NULL), and `_date_idx` is superseded by the partial `_date_active_idx` created in 0090. Both are
-- confirmed redundant before they are dropped.
DROP INDEX CONCURRENTLY IF EXISTS "obligation_collections_workspace_deleted_idx";

-- 0090 is an applied migration, so its partial `_date_active_idx` is present in every migrated
-- database; `IF EXISTS` covers a database that never had the plain index.
DROP INDEX CONCURRENTLY IF EXISTS "obligation_collections_workspace_date_idx";

-- ── 2. F10 — a distribution name is unique inside its wakala ────────────────────────────────
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "obligation_distributions_workspace_wakala_name_uidx"
  ON "obligation_distributions" ("workspace_subdomain", "wakala_type_id", "name");

-- ── 3. F9 — receipt numbers are the human key on a printed voucher ──────────────────────────
-- Must run after the duplicate pre-flight:
--
--   SELECT workspace_subdomain, receipt_no, count(*)
--     FROM obligation_collections
--    WHERE deleted_at IS NULL
--    GROUP BY 1, 2 HAVING count(*) > 1;
--
-- A non-empty result needs a renumbering decision (and, long term, the server-side allocator
-- recorded as deferred item D3) before this statement can succeed.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "obligation_collections_workspace_receipt_uidx"
  ON "obligation_collections" ("workspace_subdomain", "receipt_no")
  WHERE "deleted_at" IS NULL;

-- ── 4. Drop the non-unique index the unique partial one supersedes ──────────────────────────
-- Same columns, so every lookup the old index served is served by the new one for live rows;
-- nothing queries receipt numbers across archived rows.
DROP INDEX CONCURRENTLY IF EXISTS "obligation_collections_workspace_receipt_idx";
