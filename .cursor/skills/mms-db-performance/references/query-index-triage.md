# Database Query & Index Performance Triage

Comprehensive procedure for diagnosing slow queries, missing indexes, and Postgres query plans in MMS.

## 1. Concurrent Index Creation & Lock Safety

Standard DDL migrations run inside transactions where `CREATE INDEX` acquires an `ACCESS EXCLUSIVE` lock, blocking all reads and writes to the table. In production:
- **Never run blocking index builds** on tables with existing operational traffic (`mms-performance.md` §1).
- Use `CREATE INDEX CONCURRENTLY` executed outside migration transactions via:
  ```bash
  pnpm --filter mms-backend exec tsx src/scripts/create-index-concurrently.ts --file src/scripts/perf_concurrent_indexes_and_stats.sql
  ```

## 2. Three-Tier Soft-Delete Index Strategy

All tenant tables that implement soft-delete require partial indexes (`mms-data-layer.md` §6):
- **Category A (Partial Unique):**
  `CREATE UNIQUE INDEX table_ws_key_active_uidx ON table (workspace_subdomain, key) WHERE deleted_at IS NULL;`
  Allows soft-deleted keys to be recycled while strictly preventing duplicate active rows.
- **Category B (Active Reads):**
  `CREATE INDEX table_ws_active_idx ON table (workspace_subdomain, sort_col) WHERE deleted_at IS NULL;`
  Enables 99% of user-facing operational queries to scan only live rows.
- **Category C (Trash View):**
  `CREATE INDEX table_ws_trash_idx ON table (workspace_subdomain, deleted_at DESC) WHERE deleted_at IS NOT NULL;`
  Powers the `?view=trash` directory view.

Audit coverage with:
```bash
pnpm run check:migration-indexes
```

## 3. Covering Indexes & BRIN Indexes

- **Covering Indexes (`INCLUDE`):**
  For high-frequency aggregations (e.g. accounting balances), include payload columns to enable Index-Only Scans:
  ```sql
  CREATE INDEX CONCURRENTLY IF NOT EXISTS accounting_journal_lines_covering_idx
  ON accounting_journal_lines (workspace_subdomain, account_id) INCLUDE (debit, credit);
  ```
- **BRIN (Block Range Indexes):**
  For append-only tables with monotonic timestamps (`created_at` on `message_logs` or `attendance`), BRIN indexes reduce index size by over 95% compared to B-Trees.

## 4. Query Plan Inspection (`EXPLAIN ANALYZE`)

When a query regresses:
1. Ensure the query filters on `workspace_subdomain` first to utilize tenant indexes.
2. Verify that `deleted_at IS NULL` is present in the WHERE clause to hit the partial index.
3. Check for Seq Scans vs Index Scans:
   ```sql
   EXPLAIN (ANALYZE, BUFFERS)
   SELECT * FROM students
   WHERE workspace_subdomain = 'demo' AND deleted_at IS NULL
   ORDER BY created_at DESC LIMIT 50;
   ```
4. Verify wildcard column projections are eliminated (`pnpm run check:db-projections`).
