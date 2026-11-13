# Workshops Frontend & State-Management Audit — 2026-11-12

**Tests/CI:** coverage, concurrency and ratchets are audited in
[workshops-test-audit-2026-11-12.md](workshops-test-audit-2026-11-12.md).

**Scope:** the Workshops React module — page/tier hierarchy, detail drawer and its sections, forms and
participant picker, TanStack Query keys/invalidation, loading/empty/error states and RTL. Ninth in
the series; companions: [schema](workshops-schema-persistence-audit-2026-11-12.md),
[lifecycle](workshops-domain-lifecycle-audit-2026-11-12.md),
[subsystems](workshops-subsystems-audit-2026-11-12.md),
[API](workshops-api-layer-audit-2026-11-12.md),
[security](workshops-security-audit-2026-11-12.md),
[async queues](workshops-async-queues-audit-2026-11-12.md),
[printables/analytics](workshops-printables-analytics-audit-2026-11-12.md),
[shared contracts](workshops-shared-contracts-audit-2026-11-12.md).

## 1. Hierarchy premise corrections

| Brief assumption | Reality |
|---|---|
| `TemplateModulePage` | The module uses the shared **`ModulePageShell`** with Work/Reports/Setup tiers; no `TemplateModulePage` exists |
| Calendar / timeline views | None. Work offers table and card directory views (`WorkBatchTable`/cards) only |
| Participant roster drawer | The roster is a **section inside `WorkshopDetailDrawer`**, not a separate drawer |
| Batch completion checklist | None. Completion is a list of standings with Evaluate-all / Issue-all / per-row print; no checkbox batch |
| `TemplateFormModal` | The form uses the shared **`FormModal`** + `useWorkshopFormController` |

## 2. Findings and fixes

### Cache & invalidation

| # | Sev | Finding | Fix |
|---|---|---|---|
| Q1 | **P1** | Local mutations never invalidated dashboard-summary/dynamic-widget roots; only the WebSocket dispatcher did. A dropped socket could leave aggregate widgets stale | `invalidateWorkshopsQueries` now refreshes the module root **and** `DASHBOARD_SUMMARY_QUERY_KEY_ROOT` + `DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY`; mutation hooks await it |
| Q2 | P2 | Every mutation invalidated the whole module: attendance/scores refetched the list, metrics and preferences; preferences refetched on every roster action | Scoped helpers: roster (list/metrics/detail/completion/report), activity (detail/completion/report), preferences-only; wired per hook |
| Q3 | P2 | The exported invalidation helper and the inline `useWorkshopsMutation` policy were duplicated | All mutations now go through the helpers; the WebSocket dispatcher uses the same helper |
| Q4 | — | Positive: keys are hierarchical under `["workshops"]` (list/detail/completion/report/preferences, metrics at `["workshops","metrics"]`); `mutateAsync` waits for invalidation; server broadcasts refresh the same root | — |

**Invalidation matrix**

| Mutation | Keys refreshed |
|---|---|
| Create/update/delete/restore/transition | module root (list/detail/completion/report/preferences/metrics) + dashboard/widgets |
| Add/remove participant | list, metrics, detail(id), completion(id), report + dashboard/widgets |
| Attendance / scores | detail(id), completion(id), report + dashboard/widgets |
| Preferences | preferences only |

### Loading / empty / error

| # | Sev | Finding | Fix |
|---|---|---|---|
| Q5 | **P1** | Completion showed “no participants” while its query was still loading | `isLoading` skeleton rows (`aria-busy`, sr-only loading label) before error/empty branches |
| Q6 | P2 | Metrics strip rendered `0` on query error (false zeros) | Renders “—” when `metrics.isError` |
| Q7 | — | Page list, directory empty/loading, drawer loading/error, completion error, report error and Setup error are handled; RTL uses logical utilities only; print surfaces pass `dir` | — |

### Forms & participant picker

| # | Sev | Finding | Fix |
|---|---|---|---|
| Q8 | **P1** | Double-submit race: no synchronous lock; two rapid saves could create two workshops | `submitLock` ref acquired before `onSave`, released in `finally` so a 409 can be corrected and retried; test clicks twice and asserts one call |
| Q9 | P2 | `workshops.validation.spanTooLong` was missing from the translated validation keys | Added; test asserts the translated rule |
| Q10 | P2 | `isDirty` was only “title non-empty”, so a date/capacity edit never prompted discard | Dirty now compares every value against the initial snapshot; `FormModal` gets discard title/description/confirm/cancel labels; test edits and confirms |
| Q11 | P2 | Search fired a request per keystroke | `useDebounce(search, 300)` feeds the list query; input stays immediate |
| Q12 | P2 | Participant add could double-fire before the pending render | `addingRef` synchronous lock around `mutateAsync` (button remains pending-disabled) |
| Q13 | P3 | Validation surfaced only the first issue in a global banner | Remains global (D3); span/date/title keys are translated |

### Roster rendering

| # | Sev | Finding | Fix |
|---|---|---|---|
| Q14 | P2 | Every detail refetch re-rendered the roster/check-in/scores/completion sections and all participant rows | `React.memo` boundaries with explicit comparators over the arrays/workshop fields each section reads; attendance-only refetches skip the roster/scores |
| Q15 | P3 | Roster is unbounded (API detail has no pagination) | Deferred D1 (pagination/virtualization ties to the API audit) |
| — | P2 | Local edits/picker state could survive switching drawers because sections were reused across workshops | Sections and the drawer are keyed by workshop id, resetting local state on switch |

## 3. Tests

- `workshopsQueryInvalidation.test.ts`: exact key lists for full/roster/activity/preferences,
  including dashboard/widget roots and the absence of prefs from activity.
- `WorkshopFormModal.test.tsx`: double-submit → one `onSave`; span-too-long translated; edited
  values → discard prompt → close.
- `WorkshopCompletionSection.test.tsx`: loading state never renders the empty copy.
- Existing workshop suites (participants, check-in, lifecycle actions, certificate template/print,
  printables) remain green; memo/key changes preserve behavior.
- Full frontend/shared/backend suites + typechecks/i18n/code-norm/structure/boundary gates.

## 4. Deferred

- **D1** roster/attendance pagination + virtualization (API paged roster).
- **D2** calendar/timeline workshop views and a checkbox batch-completion checklist.
- **D3** per-field validation error mapping for every rule (first issue only today).
