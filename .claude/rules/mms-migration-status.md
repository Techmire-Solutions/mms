---
description: Active technical debt register and architectural gaps — do not fix outside scope
paths:
  - "docs/migration-*"
  - "apps/backend/src/db/migrations/**"
---

# MMS Migration Status

**Workflow skill:** `mms-migration-fixes` — prioritized gap list and recipes. Rules describe **target architecture**. Fix open gaps only when in task scope. Historical closed milestones: `docs/migration-milestones.md`.

## 1. Open Gaps Register (Active Debt)
Only address these residual gaps when explicitly within task scope:
- **Copy & a11y:** Residual hardcoded strings in secondary modules; niche RTL/contrast checks. Target: full `t()` en/ar/ur/fa + WCAG 2.2 AA (`mms-settings-i18n.md`, `mms-ui-ux-design.md`).
- **Live Push & Aggregates:** Secondary module WS emit/subscribe and comparison mode dumps. Target: WS `/api/ws` invalidate + SQL `GROUP BY` aggregates (`mms-core.md`, `mms-reports.md`).
- **Contacts Full Loads:** Niche chart dumps. Target: SQL aggregates across all visualizers (`mms-data-layer.md`, `mms-reports.md`).

## 2. Forbidden Regressions (Canonical Owners)
- **Data Authority** (`mms-data-layer.md`): `saveCollection` mutation dual-writes; `getCollection` as primary for REST; unpaged `loadAllFn` / `maxPageSize` dumps.
- **Sessions** (`mms-auth-security.md`): JWTs in `localStorage`; skipping platform `/me` session probe; failing to invalidate tokens when accounts are soft-deleted.
- **Soft-Delete UX** (`mms-module-architecture.md` §6–§7): Work trash without drawer archive banner; resetting filters on trash toggle; omitting 23505 conflict traps on restore; missing 5–10s Undo toast.
- **Soft-Delete Schema** (`mms-data-layer.md`, `mms-form-architecture.md`): JSONB-only `deletedAt`; client-supplied soft-delete fields on POST/PUT; standard `UNIQUE` on recyclable keys; direct SQL `DELETE` bypassing `forbid_hard_delete()`.
- **Query Planner** (`mms-data-layer.md` §6): Parameterized booleans breaking partial index; Drizzle `with: {}` omitting explicit `where: isNull(child.deletedAt)`.
- **Hard Purge** (`mms-data-layer.md` §6, `mms-background-jobs`): Unbounded single-transaction purges; inline HTTP request purges; omitting `entity.hard_purge` audit events.
- **Gold Standard §7** (`mms-module-architecture.md` §7): Bulk wipe PUT; closing forms before `mutateAsync` resolves; missing `ErrorState` + retry hints.
- **Work Directory** (`mms-module-architecture.md` §3): Filter preset pill bars duplicating Filters menu; `directoryViews: ['list']`; server prefs overriding local column width.
- **UI Chrome DRY** (`mms-ui-ux-design.md`, `mms-dry.md`): Hand-rolled empties / glass stacks; forked delete/restore buttons; ad-hoc chart heights or z-indexes.
- **Fields & Forms** (`mms-fields.md`, `mms-form-architecture.md`): Hardcoded allowlists dropping Setup custom fields; unlocked `basic` tab; loosening write Zod `.strict()`.
- **Person Modules** (`mms-data-layer.md`, `mms-form-architecture.md`): Persisting contact profile fields on `students` or `faculty` when `contactId` is set; filtering JSONB instead of joining `contacts`.
- **Messaging** (`mms-messaging.md`): Re-introducing `messages_u:` allowlist; FE page-walk for select-all/CSV; idempotency keys without body digests.
- **Reports** (`mms-reports.md`): Full-collection dumps for KPIs when `/metrics` exists; widget state via `saveCollection`.
- **Security & RLS** (`mms-auth-security.md`, `mms-data-layer.md`): Secrets in unscoped `objects`; omitting `FORCE ROW LEVEL SECURITY` on tenant tables; unbounded backup KDF.
- **Layout & a11y** (`mms-ui-ux-design.md` §4): Horizontal page overflow; touch targets < 44px (`min-h-11 min-w-11`); custom sub-tabs instead of `SubTabBar`.
- **File Structure** (`mms-structure-naming.md` §3): Files beyond the 300-line cap without concern split; renaming public barrels during refactors.
- **Audit Trail** (`mms-data-layer.md`, `mms-auth-security.md`): Bare `UPDATE`/`DELETE` on audit tables; deleting/re-hashing historical rows; uncanonical JSON; un-sharded hash chains.
- **Performance** (`mms-performance.md`): Blocking Redis `KEYS *`; unbuffered heap allocations in worker jobs; write-blocking index builds; unvirtualized client lists > 30 items.

## 3. Workflow & Output Speed Rules
- **Zero Output Bloat:** Output surgical diffs or targeted snippets only. Never rewrite entire files unless creating a new file from scratch. Omit conversational filler.
- **Verification Gates:** Verify with `pnpm typecheck` and scoped tests before marking tasks done. If standards are modified, execute `bash .agent/scripts/sync-all.sh` and verify with `node scripts/verify-rules-integrity.mjs`.
