---
trigger: model_decision
description: Active technical debt register and architectural gaps — do not fix outside scope
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
- **Sessions & Tenant Isolation** (`mms-auth-security.md`): JWTs in `localStorage`; skipping `/me` probe; active session retention on soft-delete; omitting `FORCE ROW LEVEL SECURITY` on tenant tables; secrets in unscoped storage.
- **Soft-Delete Lifecycle & Schema** (`mms-data-layer.md` §6, `mms-module-architecture.md` §6–§7): Bypassing `forbid_hard_delete()`; direct SQL DELETE; JSONB-only `deletedAt`; standard `UNIQUE` on recyclable keys; Work trash without drawer archive banner; omitting 23505 conflict traps or 5–10s Undo toast; parameterized boolean breaking partial index; inline/unbounded HTTP hard-purges.
- **Gold Standard & Work UX** (`mms-module-architecture.md` §3, §7): Bulk wipe PUT; closing forms before `mutateAsync` resolves; missing `ErrorState` + retry hints; filter preset pills duplicating Filters menu; `directoryViews: ['list']`; server prefs overriding local column width.
- **UI Chrome & Primitives DRY** (`mms-ui-ux-design.md`, `mms-dry.md`, `mms-shared-ui.md`): Hand-rolled empties / glass stacks; forked delete/restore buttons; ad-hoc chart heights or z-indexes; cross-console duplicate components.
- **Fields & Forms** (`mms-fields.md`, `mms-form-architecture.md`): Hardcoded allowlists dropping Setup custom fields; unlocked `basic` tab; loosening write Zod `.strict()`.
- **Person Modules** (`mms-data-layer.md`, `mms-form-architecture.md`): Persisting contact profile fields on `students` or `faculty` when `contactId` is set; filtering JSONB instead of joining `contacts`.
- **Messaging** (`mms-messaging.md`): Re-introducing `messages_u:` allowlist; FE page-walk for select-all/CSV; idempotency keys without body digests.
- **Reports** (`mms-reports.md`): Full-collection dumps for KPIs when `/metrics` exists; widget state via `saveCollection`.
- **Layout & a11y** (`mms-ui-ux-design.md` §2, §4): Horizontal page overflow; touch targets < 44px (`min-h-11 min-w-11`); custom sub-tabs instead of `SubTabBar`.
- **File Structure** (`mms-structure-naming.md` §3): Source files exceeding the 300-line cap without concern split; renaming public barrels during refactors.
- **Audit Trail** (`mms-data-layer.md` §5): Direct `UPDATE`/`DELETE` on audit tables; deleting/re-hashing historical rows; uncanonical JSON; un-sharded hash chains.
- **Performance** (`mms-performance.md`): Blocking Redis `KEYS *`; unbuffered heap allocations in worker jobs; write-blocking index builds; unvirtualized client lists > 30 items.

