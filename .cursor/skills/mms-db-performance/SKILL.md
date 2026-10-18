---
name: mms-db-performance
description: Triages PostgreSQL performance in MMS — slow queries, missing or unused indexes, N+1 patterns, autovacuum/bloat, and partition maintenance. Use when a list, report, or dashboard is slow, a query plan regressed, or DB load is climbing. Do NOT use for authoring DDL (use mms-schema-migrate), for queue backlog (use mms-queue-ops), or for frontend render/bundle cost (use mms-performance.mdc norms via mms-frontend).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Database Performance

**Rules (norms SSOT):** `mms-performance.mdc` §1 (query discipline, projections, indexes, pagination) · `mms-data-layer.mdc` §1–§7 (schema, RLS, soft-delete index tiers, autovacuum). Partition upkeep → `mms-audit-trail`.

## When to use

- A list, report, or dashboard is slow or a query plan regressed
- DB load is climbing and indexes/autovacuum need triage

## Ratchets that already run in CI

| Check | Command | What it protects |
|---|---|---|
| Wildcard projections | `pnpm run check:db-projections` | no new `SELECT *` / bare `db.select()` |
| Migration index locks | `pnpm run check:migration-indexes` | no new write-blocking `CREATE INDEX` on large tables |
| Audit partition upkeep | `pnpm --filter mms-backend audit:partitions` | monthly partitions exist ahead of time |
| Worker heap | `pnpm --filter mms-backend benchmark:worker` | per-job memory ceiling |

Run the relevant ratchet before and after a change — a green ratchet is the cheapest proof you did not regress the class of problem it guards.

## Triage procedure

1. **Measure before changing anything.** Capture the query, the plan, and the timing:
   ```sql
   EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) <query>;
   ```
   Note the actual row counts vs estimates; a 100× estimate miss usually means stale statistics or a predicate PostgreSQL cannot use (see §3 below).
2. **Find the offenders** — `pg_stat_statements` by total time, not by mean; `pg_stat_user_indexes` for unused indexes; `pg_stat_user_tables` for sequential-scan-heavy and high-`n_dead_tup` tables.
3. **Check the three MMS-specific causes before adding an index:**
   - **RLS not applied as expected** — tenant predicates must be in the plan; if the plan shows a full scan of a multi-tenant table, the query is not scoped by `workspace_subdomain` at all (`mms-data-layer.mdc` §1).
   - **Parameterized boolean predicates on soft-delete** — `WHERE ($2::boolean IS TRUE OR deleted_at IS NULL)` defeats the Category B partial index. Conditionally append `isNull(table.deletedAt)` in the Drizzle AST instead (`mms-data-layer.mdc` §6.6).
   - **N+1 from a loop** — one query per row inside `map`/`forEach`; batch with `inArray`, relational `with:`, or a `/resolve` endpoint (`mms-performance.mdc` §1).
4. **Index with the MMS conventions:** prefix compound indexes with the tenant scope, add the matching partial index for the active/trash split (`WHERE deleted_at IS NULL` / `IS NOT NULL`), and use BRIN for append-only time-series (`transaction_timestamp`, `created_at`) rather than another B-tree (`mms-data-layer.mdc` §6.3, `mms-performance.mdc` §1).
5. **Build indexes without locking the app:**
   ```bash
   pnpm --filter mms-backend index:concurrent
   ```
   A plain `CREATE INDEX` in a migration is a production write-stall — the CI ratchet blocks new ones, and existing usage is baselined, not endorsed (`mms-data-layer.mdc` §7). For deep query plans, BRIN indexes, and covering index recipes, see [references/query-index-triage.md](references/query-index-triage.md).
6. **Bloat and autovacuum:** high-churn soft-deletable tables (`message_logs`, `audit_trail_events`, `attendance_records`) carry aggressive autovacuum settings; verify they were applied before considering manual `VACUUM`.
7. **Pagination is not optional:** every collection query must be bounded (default `limit: 25`, hard max `100` via `baseListQuerySchema`). An unbounded dump is a performance bug and a review blocker (`mms-performance.mdc` §1).

## Report the numbers

State baseline vs after (plan nodes, rows, buffers, milliseconds) and what you changed to get there. "Feels faster" is not a result; `mms-completion-review.mdc` requires the quantified resource saved.

## Do not

- Add an index to hide an N+1 or a wildcard projection.
- Add an index without a matching predicate: unused indexes still cost write throughput.
- Run `CREATE INDEX` in a migration on a large table, or `VACUUM FULL` on a live table.
- Change a query plan by disabling the planner (`enable_seqscan = off`) in application code.

## Related skills

`mms-schema-migrate` (DDL authoring + lock safety), `mms-soft-delete` (index tiers and purge), `mms-audit-trail` (partitioned audit tables), `mms-queue-ops` (slow background jobs).
