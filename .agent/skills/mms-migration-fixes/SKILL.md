---
name: mms-migration-fixes
description: Addresses the open priorities P1–P7 in mms-migration-status.md — schema realignment, soft-delete debt, and residual architecture gaps. Use when working an item that is explicitly listed as open debt in that register. Do NOT use for new feature work (use mms-module-page), schema DDL authoring (use mms-schema-migrate), soft-delete feature work (use mms-soft-delete), or dependency bumps (use mms-dependency-upgrade).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
allowed-tools: Read Grep Glob Bash(pnpm typecheck) Bash(pnpm test)
---

# MMS Migration Fixes

**Rule (norms SSOT):** `mms-migration-status.md` · `mms-core.md` · `mms-completion-review.md`.

## When to use

- Working an item listed as open debt in the migration-status register
- Closing or re-scoping a P1–P7 migration debt item

Only implement items **in scope** for the current task.

- **Do not reintroduce themes** (residual debt register): `rules/mms-migration-status.md` (closed milestones → `docs/migration-milestones.md`)
- **Open gaps detail** (this skill): prioritized P1–Pn below — the rule keeps a short summary only.

When the user asks to fix migration debt, work from the open priorities here and the owning scoped rules.

The closed-items register (61 rows of "do not reintroduce") is historical reference: **`references/resolved-register.md`**, with closed migration milestones in `docs/migration-milestones.md`.

## Open priorities

Residual Work SQL-page debt for **other** modules (not Faculty/Users/Sessions) lives under “SQL pagination / oversized shells” in `mms-migration-status.md`.

### P1 — Soft-delete / schema remaining gaps

**Problem:** Gaps identified across entity schemas, routes, and background workers (`docs/soft-delete.md` §11). **All five items resolved/verified 2026-09-18** — full verification record in `references/resolved-register.md`:
1. **High**: Missing partial unique indexes on `email`/`phone`/`employee_id` for contacts, students, faculty — archived rows block re-registration of the same email. — **verified resolved 2026-09-18**: `faculty_workspace_employee_id_active_uidx` (0104, renamed by 0112), `students_workspace_gr_number_active_uidx` / `students_workspace_student_id_active_uidx` (0104), `tenant_users_workspace_login_email_active_idx` (0108) all present in the live schema; the `contacts` email/phone DO-block guards in 0108 intentionally no-op on the current schema (email/phone live in `contact_emails`/`contact_phones` child tables by design — no unique constraint is correct there), while login uniqueness for re-registration is enforced on `tenant_users.login_email`.
2. **Medium**: Missing Category B partial indexes (`WHERE deleted_at IS NULL`) and Category C partial indexes (`WHERE deleted_at IS NOT NULL`) on 10+ tables (faculty, sessions, enrollments, finance, accounting, obligations, hasanat, examinations). — **verified resolved 2026-09-18**: all 20 soft-deletable tables carry both a Category B and a Category C index; the only information_schema "miss" was the migration-defined compat view `teachers` (`0113_faculty_department_designation.sql`: `CREATE VIEW teachers AS SELECT * FROM faculty`), which needs no indexes of its own.
3. **Medium**: Missing `deleted_with_cascade` column on `enrollments` — cascade restore from session restore cannot be distinguished from standalone archive. — **verified resolved 2026-09-18**: column added by `0104_soft_delete_system_complete.sql` and extended to all 19 soft-deletable tables by `0108_soft_delete_schema_rls_and_triggers.sql`.
4. **Low**: Inconsistent inline ternaries for `includeDeleted` in `sessions.ts` / `finance.ts` (replace with `isQueryFlagTrue`). — **verified resolved 2026-09-18**: no raw string comparisons remain; routes standardize on `isQueryFlagTrue` and `normalizeIncludeDeletedFlag` helpers.
5. **Low**: Unimplemented scheduled retention hard-purge worker (`purgeExpiredArchivedRecords`) — **resolved 2026-09-18**: implemented in `apps/backend/src/worker/purgeArchivedRecordsJob.ts` and scheduled daily at 02:00 UTC by `apps/backend/src/worker/index.ts` (`scheduleNextDailyPurge`, single-leader lease); recorded in `references/resolved-register.md` and matches `docs/migration-milestones.md`.

**Fix:**
- Partial unique indexes (`WHERE deleted_at IS NULL`) already landed in `apps/backend/src/db/migrations_drizzle/0104_soft_delete_system_complete.sql`; verify remaining tables against the three-tier index strategy rather than adding a new migration by hand.
- Category B/C partial indexes live in the same baseline — audit coverage with `pnpm run check:migration-indexes` and add missing pairs as forward-only DDL (`mms-data-layer.mdc` §7).
- Add `deleted_with_cascade` column to enrollments; update session cascade soft-delete and restore logic (`docs/soft-delete.md` §2.2).
- Standardize all query-flag parsing on `isQueryFlagTrue`.
- **Resolved 2026-09-18** — `purgeExpiredArchivedRecords` lives in `apps/backend/src/worker/purgeArchivedRecordsJob.ts` (bounded 500-row chunks, `FOR UPDATE SKIP LOCKED`, 50 ms inter-chunk pause, `entity.hard_purge` audit event + outbox CDC events, tenant-scoped) and runs on the daily 02:00 UTC schedule registered in `apps/backend/src/worker/index.ts` (`scheduleNextDailyPurge`, single-leader lease) — matching "Retention Hard-Purge: Implemented" in `docs/migration-milestones.md` (`docs/soft-delete.md` §13).
- Do not regress Messaging clear or QB papers/results variants without an explicit product change. Users soft-delete is in the squashed baseline (`tenant_users.deleted_at` in `0000_init` + forward migrations).

**Skills:** `mms-soft-delete`, `mms-module-work`, `mms-module-page` (§7), `mms-frontend`, `mms-backend-api`, `mms-schema-migrate`, `mms-background-jobs`

### P2 — Residual permission / role special cases

**Problem:** Platform `super_user` checks, setup matrices (`RolesPermissions`), and a few non-gate `role` comparisons remain outside module write surfaces. — **audited 2026-09-18**: all 54 raw comparisons (32 backend, 22 frontend) were classified; every one is a deliberate non-gate surface — platform-admin checks (`authenticatePlatform`, `platformWorkspaces`, `platformUserRepository`), the session-validation faculty branch in `authenticate.ts`, messaging recipient-group selectors, query filters, UI selection state, and data-flow assignments. The single genuine tenant-module write gate on a raw role comparison is `apps/backend/src/routes/common/ai.ts` (`user.role !== 'admin'` on the AI configuration preHandler); recorded as a deliberate decision — migrating it to workspace permission-map evaluation is a product behavior change (custom roles with full `settings` permission would gain access), pending an explicit product decision, not an omission.

**Fix:** Prefer `can()` / contract permissions when touching those UIs; do not add new tenant-module `role ===` write gates (`mms-auth-security.md`).

### P4 — Report drill-down & saved reports

**Problem:** Contacts has typed saved reports + share scopes; pinned widgets/visualizer are Query-first. Other modules lag on drill-down / share parity; some niche charts still client-reduce. — **saved-reports parity delivered 2026-09-18**: the generic `/api/saved-reports` router (`apps/backend/src/routes/tenant/savedReports.ts`, registered in `apps/backend/src/routes/index.ts`) was realigned to the contract — owner-scoped repository calls, `permissions.read` gating per category via a full 15-category manifest map (`teachers`→faculty, `financial`→finance, `obligations`→finance, `messaging`/`users`→contacts), `createCollectionAuditHelper` audit verbs `<module>.saved_report.create|delete|run` — plus a real bug fix: the FE sends `body: {}` on delete/run while the contract typed those bodies `z.void().optional()` (rejected → 400), now normalized in a plugin preHandler. The FE side was already wired (`useGenericSavedReportsSource` + generic `SavedReports` in `ModuleReportsToolPanels`), so all 15 module categories gained working saved reports at once. 17 new inject() allow/deny tests (`savedReportsContractRoutes.test.ts`); orphaned `services/savedReportsService.ts` removed. **Residual (opportunistic, unchanged)**: some niche charts still client-reduce — prefer `/metrics` / server aggregates over full-row dumps when touching those surfaces (`mms-reports.md`, skill `mms-reports-export`).

### P5 — Responsive e2e depth

**Problem:** Shells + Work-route smoke are green (`responsive-shell` / `responsive-authenticated`). Platform `md` bottom nav and deep Reports/Setup builders are not asserted.

**Fix:** Extend those specs when touching those surfaces — `mms-ui-ux-design.md` §4, `mms-testing-observability.md`. Do not treat missing depth as license to regress shell overflow/touch floors.

### P7 — PG statement timeout budgets (residual)

**Problem:** Tenant-bound budgets ship on `withTenant` + `runInTransaction` (`PG_STATEMENT_TIMEOUT_MS` / `PG_IDLE_IN_TX_TIMEOUT_MS`). Residual: optional tighter per-route budgets on hot paths.

**Fix:** When touching hot routes, prefer tighter `SET LOCAL` budgets — `mms-data-layer.md` (align with Fastify `requestTimeout`).

## After each fix

```bash
pnpm typecheck && pnpm test
cd apps/backend && pnpm lint   # if BE touched
cd apps/frontend && pnpm lint  # if FE touched
```

Update `mms-migration-status` **Recently resolved** when fully done.

## Rules sync

After changing standards:

```bash
bash .agent/scripts/sync-all.sh
```

## Related skills

`mms-schema-migrate`, `mms-release-versioning`, `mms-soft-delete`, `mms-code-review`.
