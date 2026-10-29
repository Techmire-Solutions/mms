# Fix-before-done reference

Moved out of the always-on `mms-completion-review.md` rule: this is a lookup table
used *while* finishing a change, not something that needs to load on every task.
The rule keeps the required steps and the skip conditions; this file keeps the
per-finding remedies and the review criteria.

## Finding → action

| Finding | Action |
|---------|--------|
| Type error | Fix and re-run `pnpm typecheck` |
| ESLint error | Fix in the changed files |
| Failing test | Fix or revert — never ship a broken test |
| Weak assertion | Replace `toBeTruthy()` / `toBeFalsy()` / generic `toBeDefined()` with a strict type check, a format regex (`/^\d{4}-\d{2}-\d{2}T/`), or a DOM instance assertion (`mms-testing-observability.md` §1) |
| DB skip latch (`isDbAvailable`) | Use mocks for ordinary route tests; use the explicit PostgreSQL suite for database invariants and report unavailable infrastructure as blocked, never passed — `mms-testing-observability.md` §1 |
| Unspied error logs in tests | Spy on `console.error` / `console.warn` in negative tests so output stays clean |
| Hardcoded copy | Add `t()` keys and update all four locale packs — `mms-settings-i18n.md` (ban `t(key) \|\| 'English'`) |
| Work `ErrorState` title-only | Add the hint description (`loadFailedHint` pattern) — `mms-module-architecture.md` §3 |
| Manifest `directoryViews: list` with table/cards UI | Align to `['table','cards']` — `mms-module-architecture.md` §3 |
| File still well over 300 lines with a clean seam | Split by concern behind a stable barrel — `mms-structure-naming.md` |
| Bulk PUT dropped rows | Upsert/merge without deleting absent rows — `mms-api-interface.md` §5 |
| Form closed before the mutation resolved | Await `mutateAsync` before closing the dialog or clearing state — `mms-form-architecture.md` |
| Direct SQL `DELETE` on a tenant entity | Route through soft-delete or check `app.allow_hard_purge` — `mms-data-layer.md` §6 |
| Unique constraint on a recyclable soft-deletable key | Use a partial unique index `WHERE deleted_at IS NULL` — `mms-data-layer.md` §6 |
| Cross-feature import added | Route through the `@/tenant/hooks/collections/*` facade or extract to `components/app` / `components/ui` / `lib/` / `@mms/shared` — the boundary lint fails otherwise (`mms-dry.md`) |
| Banned Node-24 package introduced | Replace with the native built-in (`fetch`, `glob`, `crypto.hash`, `URLPattern`, `--env-file`) — `mms-dependencies.md` |
| Non-erasable TS syntax (`enum`, `namespace`, parameter properties) | Replace with union types / const objects — `mms-dependencies.md` |
| Unprefixed core-module import | Prefix with `node:` (`node:fs`, `node:crypto`, `node:path`, `node:async_hooks`) — `mms-structure-naming.md` |
| Deprecated Node API (`url.parse()`) | Replace with WHATWG `new URL()` — `mms-structure-naming.md` |
| Undocumented performance refactor | State the baseline bottleneck and the quantified resource saved — `mms-performance.md` |
| Unvirtualized list/table over 30 items | Add `@tanstack/react-virtual` — `mms-performance.md` |
| Wildcard DB query (`SELECT *` / bare select) | Replace with an explicit typed column projection — `mms-performance.md` |
| Missing partial unique index on a recyclable key | Add it, then re-check the 23505 restore trap — `mms-data-layer.md` §6 |
| Missing `ENABLE`/`FORCE ROW LEVEL SECURITY` on a new tenant table | Add both plus the policy (`0076_force_rls_all_tables.sql` pattern) — `mms-data-layer.md` §1 |
| Write-blocking `CREATE INDEX` in a migration | Move it to the concurrent index script — `mms-data-layer.md` §7 |
| Missing module access gate (BE or FE) | Register in `MODULE_ROUTE_ACTION_RULES` / `TENANT_APP_ROUTE_ACCESS` and verify with `moduleAccessCoverage.test.ts` / `routeAccess.test.ts` — `mms-auth-security.md` §3 |
| Hand-rolled data table in directory | Replace with shared `DataTable` / `WorkBatchTable` stack — `mms-dry.md` §1 |
| Raw hex or arbitrary-colour expression in code | Replace with semantic CSS custom property token from `index.css` `@theme` — `mms-ui-ux-design.md` §2 |
| Explicit `any` annotation introduced | Replace with strict Zod schema, union type, or `unknown` narrowing — `mms-dry.md` §4 |
| Missing `AbortSignal` on fetch or query | Pass `signal` from `queryFn` or pass `AbortSignal.timeout()` to `apiFetch` — `mms-agent-universal.md` §3 |
| Rule/skill edited but mirrors not regenerated | Run `bash .agent/scripts/sync-all.sh` and re-verify |
| Any other rule violation inside the change boundary | Fix it in the same change |

## Review criteria (what "reviewed" means)

- **Reviewable size:** one concern, and preferably well under ~400 changed lines. A mixed refactor-plus-behaviour change set should be split before review — it is the most common source of missed bugs.
- **Elevated scrutiny / second reviewer** for authentication and RBAC changes, anything touching tenant isolation or RLS, migrations, cryptographic or backup/restore code, payment and ledger paths, and CI/deploy configuration. Mistakes there are not recoverable by a follow-up commit.
- **The diff carries its own evidence:** tests for new behaviour, a regression test for a fix, and the actual output of whatever verification ran. "Should be fine" is not evidence.
- **Rule citations are verified, not assumed** — the standards verifier checks that every cited rule and section exists.
- **Pre-existing debt is named, not silently inherited:** if the file already violated a norm and the fix is out of scope, say so and point at the register (`mms-migration-status.md`).
