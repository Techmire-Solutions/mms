# MMS Completed Architectural Milestones

Historical register of architectural milestones closed during MMS migration and modernization. Preserved for reference; active agent rules enforce current invariants rather than carrying historical logs.

## Completed Milestones

- **Vertical Module Extraction** (completed 2026-11-26): every backend business domain now lives in a `@mms/mod-*` package under `packages/modules/` — 21 modules (accounting, analytics, attendance, audit, billing, contacts, documents, enrollments, examinations, faculty, hasanat, iam, messaging, notifications, obligations, platform, question-bank, sessions, students, tasks, workshops). `apps/api/src` holds only kernel/composition code; every former cross-domain import is a declared port bound in `apps/api/src/modules/*/adapters.ts`; `apps/api/src` has no business-domain directory, and `check-module-boundaries` / `check-topology` pass.
- **RBAC**: Replaced legacy `role ===` write gates with contract `can()` via `useModulePermissions(manifest)` (`mms-auth-security`).
- **Setup & Prefs**: Migrated all module preferences and lookups to typed relational tables (`mms-fields`, `mms-data-layer`).
- **PG Statement Budgets**: Enforced route-level query budgets on hot paths via `statementTimeoutMs` (`mms-data-layer`).
- **CSRF / Origin Gate**: Enforced strict `Sec-Fetch-Site` and origin validation on all mutation routes (`mms-auth-security`).
- **SQL Pagination**: Migrated all collection lists to server SQL `LIMIT`/`OFFSET` (`mms-data-layer`).
- **Soft-Delete System**: Added Category B/C partial indexes, partial unique indexes (`WHERE deleted_at IS NULL`), cascades, and session revocation (`mms-data-layer` §6).
- **Retention Hard-Purge**: Implemented background purge worker in bounded chunks of 500 rows with lock-free `SKIP LOCKED` (`mms-data-layer` §6).
- **4-Locale Translation Parity**: 100% dictionary completeness across all 8,026 keys in en/ar/ur/fa validated via `check:i18n`; zero missing or untranslated fallbacks (`mms-settings-i18n`).
- **Live Push & Aggregates**: Closed across all primary and secondary modules via `genericRelationalService` broadcasting and `invalidateModuleQueries` dispatcher (`mms-core`).
- **Tenant RLS Coverage** (shipped 2026-09-18 in migration `0116_force_rls_missing_tenant_tables.sql`): All 17 active tenant tables carry per-table `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` + `tenant_isolation_policy` matching the `0076_force_rls_all_tables.sql` pattern (`mms-data-layer` §1). Verified via `check-migrations.sh`.
- **Performance Optimization Architecture B1–B15** (shipped 2026-09-18): Keyset pagination (`afterId`, `skipCount`, `nextCursor`) and TanStack Query `infiniteQueryOptions` in Contacts & Students; non-blocking cursor Redis `SCAN` (`COUNT 200`) and prefix matching in cache fallback; compile-time fast JSON response schemas on hot routes; BullMQ worker concurrency tuned to 6 with heap backpressure sentinel (>85% total heap triggers GC delay); `0117_attendance_composite_active_idx.sql` migration; out-of-band concurrent BRIN, covering, and stats script (`perf_concurrent_indexes_and_stats.sql`); CSV streaming `skipCount` bypass; DOM virtualization (`@tanstack/react-virtual`) on large attendance rosters and message recipient chips; ETag payload limit elevated to 4MB (`mms-performance`, `mms-data-layer`).

