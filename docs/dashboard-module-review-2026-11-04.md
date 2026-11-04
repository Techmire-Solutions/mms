# MMS Dashboard Module Review — 2026-11-04

Independent, read-only review of the Dashboard home shell at `main` (`60245210a`, working tree clean at
review time). **First dedicated dashboard review; no prior dashboard document exists.** Line numbers are
from the tree as reviewed.

Scope: `apps/frontend/src/tenant/features/dashboard/**` (26 files: page, 10 components, 9 hooks/helpers,
types), `tenant/hooks/collections/dashboard.ts`, `apps/backend/src/routes/tenant/dashboard.ts` and every
service/lib it imports (`dashboardSummaryService`, `dashboardPreferencesService`, `lib/dashboardWidgetsService`,
`db/repositories/dashboard{Preferences,Widgets}Repository`, `db/schema/dashboard`), `packages/shared/src/dashboard/**`,
`contracts/dashboard.contract.ts`, plus the cross-cutting governance files (`routeAccess.ts`, `moduleRegistry.ts`,
`moduleAccessPolicy.ts`, `globalSettingsModuleRegistry.ts`, `lib/moduleRouteActions.ts`,
`moduleAccessCoverage.test.ts`). Dashboard is correctly modelled as a non-CRUD module (no three tiers) and was
not faulted for that. The nine module metric snapshots it consumes were inspected only where consumed.

## 1. Baseline evidence

| Check | Result |
| --- | --- |
| `pnpm typecheck` (shared, backend, frontend) | Pass |
| `check:code-norms` / `check:work-directory` / `check:db-projections` | Pass |
| `check:frontend-structure` / `check:backend-boundaries` / `check:faculty-domain` | Pass |
| `moduleAccessCoverage.test.ts` | 1 / 1 passed |
| `routeAccess.test.ts` | 11 / 11 passed |
| Backend `task dashboard` suite | 41 passed |
| Frontend `features/dashboard` suite | Green |

Counts above are the coordinating run's baseline for this tree. **This audit's own method was static**: every
in-scope file was read in full and each query was traced contract → ts-rest router → handler → service → Drizzle
statement. No database, browser, axe or Playwright pass was executed here, so nothing below is a Red-phase
reproduction; runtime/visual claims are confined to §9.

## 2. Verdict

No authorization *escalation* was found: every mutating dashboard route re-checks
`settings.global.write|customization.view` in the handler, the summary is genuinely section-filtered by per-module
read permission, and `authenticateTenant` replaces the JWT role with the authoritative matrix role before any
handler runs. The real defects are **per-user state ownership** and **write-path shape**: preferences and pinned
widgets are stored as a workspace singleton with no user key, so one user's customization silently rewrites every
colleague's home with no version/conflict guard; and `PUT /api/dashboard/preferences` full-replaces the document
while its own DTO advertises an all-optional partial body. The frontend compounds this with a stale-closure
read-modify-write and one server write per threshold keystroke. The data layer is clean (tenant predicates,
parameterized values, bounded rows, explicit projections), but the declared `analytics.view` permission is never
enforced and the client-supplied `date` flows unbounded into a cache key.

## 3. Findings detail

### D1 — Major — Preferences and widgets are workspace-global, not per-user

**Evidence.** `apps/backend/src/db/schema/dashboard.ts:14,24`
```ts
/** Dashboard layout/chart preferences — workspace singleton (was document-store `mms_dashboard_preferences`). */
  (table) => [primaryKey({ columns: [table.workspaceSubdomain] })],
```
`dashboardWidgets` is `primaryKey({ columns: [table.workspaceSubdomain, table.id] })` (`:52-53`) — no user
dimension either. Both repositories use the workspace-singleton factory (`dashboardPreferencesRepository.ts:4-9`,
`moduleSetupRepoSingletonJson.ts:27`), and every widget statement scopes by `workspace_subdomain` alone
(`dashboardWidgetsRepository.ts:101-104,138-144,158-165`). The route never passes the session user into the write
(`routes/tenant/dashboard.ts:118-131`):
```ts
const saved = await saveDashboardPreferences(
  normalizeDashboardPreferences(body as DashboardPreferences),
);
```
**Production path.** `PUT /api/dashboard/preferences` (gate `availability`) → `canWriteDashboard` (requires only
`settings.global.write` **or** `configuration.view`) → normalize → `upsert` on
`onConflictDoUpdate({ target: table.workspaceSubdomain })`. Widgets take the identical path via
`PUT /api/dashboard/widgets` and `DELETE /api/dashboard/widgets/:id`.
**Consequence.** A workspace with two admins (or a principal plus a registrar, both holding `configuration.view`)
has exactly one dashboard: hiding a card, changing a threshold, deleting a widget or switching density by user A
mutates what user B sees on next load — permanently, without notification. The audit entry
(`:120-124`, `auditDashboard(user, "dashboard.preferences", …)`) attributes a personal action with no subject
scope, so the trail cannot distinguish "my layout" from "everyone's layout". No version column exists, so the loss
is undetectable and unrecoverable.
**Proposed fix.** Add `userId` to the preferences key and pass `request.user.id` (the per-user repo factory already
exists: `moduleSetupRepoColumnPrefs.ts:13`); make widgets per-user or add an explicit `scope` (`personal|workspace`)
with workspace writes pinned to an admin-only action; migrate the singleton row to the workspace default. If a
shared board is deliberate, say so in the manifest, require `settings.global.write` (not `configuration.view`) for
customize writes, and stop presenting the controls as personal.

### D2 — Major — No conflict control: read-modify-write from a stale closure

**Evidence.** `apps/frontend/src/hooks/useDashboardConfig.ts:76-79`
```ts
const updatePref = useCallback(
  <K extends keyof DashboardPreferences>(key: K, value: DashboardPreferences[K]) => {
    prefsMutation.mutate({ body: { ...prefs, [key]: value } });
```
`prefs` is `prefsQuery.data ?? DEFAULT_DASHBOARD_PREFERENCES` (`:55`), replaced only after the PUT resolves and the
query refetches (`useDashboardSetupConfig.ts:96-104`); `toggleCardVisibility` (`:102-109`) derives its `Set` from
that same stale `prefs.disabledCardIds`. The preferences mutation has **no** `onMutate` — contrast reorder
(`useDashboardSetupConfig.ts:147`). Threshold inputs write on every keystroke
(`DashboardAlertThresholdsSection.tsx:45,61`):
```tsx
onChange={(e) => {
  const val = parseInt(e.target.value, 10);
  if (!isNaN(val) && val >= 1 && val <= 100) {
    onUpdateThreshold("lowAttendanceThreshold", val);
```
**Production path.** Checkbox → `toggleCardVisibility` → `updatePref` → `PUT /api/dashboard/preferences` carrying
the whole document. Typing `60` fires `PUT …6` then `PUT …60`.
**Consequence.** Clicking card A then card B inside one round-trip sends `disabledCardIds:[A]` then `[B]` — A
silently reappears. A three-digit threshold issues three full-document writes; responses can land out of order and
the stored value need not be the last digit typed. Because D1 makes the document workspace-wide these lost updates
also clobber other users.
**Proposed fix.** `onMutate` optimistic `setQueryData` + rollback; compute the next value from the query cache, not
the render closure; debounce/commit-on-blur thresholds; add an `updatedAt`/version echo with a 409 (or a documented
last-write-wins) story.

### D3 — Major — Partial PUT erases every omitted preference

**Evidence.** `packages/shared/src/dashboard/dashboardPreferencesTypes.ts:72-89` — every field `.optional()`, then
`.passthrough()`:
```ts
export const dashboardPreferencesPutBodySchema = z
  .object({
    disabledCardIds: z.array(z.string()).optional(),
    gridMode: z.enum(GRID_MODES).optional(),
    ...
  })
  .passthrough();
```
The handler normalizes that partial straight over the stored row (`routes/tenant/dashboard.ts:119-120`), and
`normalizeDashboardPreferences` substitutes `DEFAULT_DASHBOARD_PREFERENCES` for every absent key
(`dashboardPreferencesTypes.ts:120-200`).
**Production path.** `PUT {"gridMode":"compact"}` is schema-valid → `normalizeDashboardPreferences({gridMode:"compact"})`
→ `{disabledCardIds:[], lowAttendanceThreshold:75, urgentAttendanceThreshold:60, enrollmentChartType:"area", …}`. The
integration test sends exactly this payload (`__tests__/dashboardSetup.integration.test.ts:123,142`) but stubs
`saveDashboardPreferences` (`:38-42`), so the wipe is invisible; the stub's return value even omits
`lowAttendanceThreshold`/`urgentAttendanceThreshold` while the test still expects 200, confirming responses are not
validated.
**Consequence.** Any client that follows the DTO (or the exported `DashboardPreferencesPutBody` type) and sends only
what it changed silently destroys card visibility, thresholds and chart configuration. This is the documented body
shape, not a malformed request.
**Proposed fix.** Read the stored row, spread the body over it, then normalize — in one transaction with
`SELECT … FOR UPDATE`; or require a complete document in the DTO, which is what the handler actually implements.

### D4 — Major — Widget write DTO is looser than the table it writes

**Evidence.** `packages/shared/src/dashboard/dashboardWidgetSchema.ts:38-45`
```ts
id: z.string().min(1),
title: z.string(),
titleKey: z.string().optional(),
category: z.string(),
collection: z.string(),
```
against `apps/backend/src/db/schema/dashboard.ts:38-48`: `category varchar(64)`, `collection varchar(64)`,
`role varchar(32)`, `title varchar(255)`, `icon varchar(64)`, `color varchar(32)`, `operation varchar(32)`. The schema
is `.passthrough()` (`:79`) and `toRow` copies every non-indexed key into `config` jsonb
(`dashboardWidgetsRepository.ts:22-51`).
**Production path.** `PUT /api/dashboard/widgets` passes contract validation (no string `max`) →
`upsertDashboardWidgets` → Postgres `22001 value too long for type character varying(255)` → route `catch` →
`500 {type:"database_error"}` (`routes/tenant/dashboard.ts:147-153`). Per-widget `config` is unbounded; only the
array is capped (`max(500)`, `dashboardWidgetSchema.ts:242`) and the 1 MB body limit
(`config/serverConfig.ts:192`).
**Consequence.** A long widget title from the WidgetBuilder returns an opaque, unlogged 500 instead of a 400; repeated
upserts can grow one `config` value toward the body limit with no per-field bound.
**Proposed fix.** Mirror the column limits in `customWidgetSchema` (`title.max(255)`, `category.max(64)`,
`collection.max(64)`, `role.max(32)`, `icon.max(64)`, `color.max(32)`), reject or cap `config`, and log the catch.

### D5 — Major — Permission-denied metric cards render as zeros

**Evidence.** `useDashboardMetricCards.ts:36-40`
```ts
const enabledDashboardCardWidgets = dashboardCardWidgets.filter((widget) =>
  isDashboardWidgetModuleEnabled(widget, enabledModules),
);
```
Compare pinned widgets, which apply both predicates (`useDashboardPageController.ts:114-118`:
`isDashboardWidgetAllowed(widget, enabledModules, can)`), and the data path, which *does* apply permission
(`useDashboardData.ts:91-99` `canReadModule`, gating every `shouldLoad*` and hence every hook at `:153-186`).
**Production path.** A card whose module is enabled but whose read permission the role lacks survives
`useDashboardMetricCards`; `useDashboardData` correctly refuses the fetch, so `data.*Metrics` stay `undefined`;
`buildDashboardMetricCard` falls through to `const value = resolvedMetric?.value ?? "0"` (`:117-118`).
**Consequence.** The card renders a definitive zero — e.g. "Outstanding" or "Revenue" showing `Rs 0` to a role that
may not see finance — worse than hiding it. Default seeded roles align (admin/accountant/faculty cards carry matching
`role` tags), so this becomes reachable through a custom card tagged to a role lacking the module's read permission,
or after a role's permissions are narrowed (the card remains; its data silently zeroes).
**Proposed fix.** Pass `can` into `useDashboardMetricCards` and filter with
`isDashboardWidgetAllowed(widget, enabledModules, can)`; add a spec that a role without `finance.read` gets no
finance card.

## 4. Minor findings

| ID | Finding | Evidence |
| --- | --- | --- |
| m1 | `/summary` never enforces the manifest's declared `read: analytics.view`; `role` is accepted and ignored. No cross-module leak (sections are filtered), so the declaration is dead on the only read route. | `dashboardModuleManifest.ts:19`; `dashboard.ts:227`; `dashboardSummaryService.ts:49` `_role?: string` |
| m2 | Summary cache key interpolates the raw client `date` with no format/length validation (contrast `attendanceRepositoryMetrics.ts:22` `DATE_RE`); each distinct value misses, re-runs the 9-way aggregation and leaves a stale key. | `lib/redisKeys.ts:23-24`; `dashboardSummaryService.ts:55`; contract `date: z.string().optional()` |
| m3 | Silent 500s: `handleDashboardRead` and every mutating handler catch without logging (only the summary handler logs). | `routes/tenant/dashboard.ts:57-63, :110, :150, :180, :207` |
| m4 | The legacy→server widget seed reads browser-global localStorage (`kpi_custom_widgets`) and pushes it into the *workspace-global* set from whichever writer loads first; `cachedMigrationSeed` is module-scoped, so it survives a tenant switch in one session. | `hooks/useDashboardConfig.ts:28-36,61-75`; `lib/reports/widgetDefaultsStore.ts:56-58` |
| m5 | Dismissal state uses tenant-agnostic sessionStorage keys, so dismissing a notification or the setup callout in one workspace suppresses it in the next for the same tab. | `NotificationsPanel.tsx:19`; `SetupIncompleteCallout.tsx:27` |
| m6 | The loading grid has no `aria-busy`/`role="status"`/loading text and always renders four skeletons regardless of card count — contrary to the list-state convention. | `StatisticsGrid.tsx:45-50`; convention `components/app/ModuleWorkListStateShell.tsx:69` |
| m7 | Opening/closing the inline WidgetBuilder moves and returns no focus; the only affordance is a smooth scroll, so keyboard users Tab-walk the grid to reach content inserted above them. | `useDashboardPageController.ts:57-70`; `DashboardCustomizePanel.tsx:58-79` |
| m8 | `isInstitutionProfileComplete` uses OR, so one branding field (e.g. a tagline) marks the profile "complete" and permanently suppresses the setup callout. | `SetupIncompleteCallout.tsx:17-26` |
| m9 | Six of seven `dashboardApi.ts` functions have no production consumer (hooks call `tsrClient` directly); the file duplicates the transport and `deleteDashboardWidgetAsync` never checks the response status, unlike `reorderDashboardWidgetsAsync`. | `dashboardApi.ts:11-44,53-69`; only `fetchDashboardSummaryAsync` imported (`useDashboardSetupConfig.ts:13`) |
| m10 | `reorderWidgets` accepts an unbounded `order` array while `putWidgets` is capped at 500; the repo expands it into one `CASE WHEN` per entry, bounded only by the 30 s statement timeout. | `contracts/dashboard.contract.ts:94-100`; `dashboardWidgetsRepository.ts:163-175`; contrast `dashboardWidgetSchema.ts:242` |
| m11 | The FE sends every widget of a collection in one request with no chunking to the server's 32 cap and ignores the status, so an overflow silently degrades to zero-valued widgets. | `students/hooks/useStudentsAnalyticsQueries.ts:96-113`; cap `schemas/common.dto.ts:47` |
| m12 | Two trend semantics share one chip: `attendanceTrend` is a percentage-**point** delta, others are percent change (which can exceed 100 %), and both print with `formatPercent`. | `dashboardMetricTrends.ts:38-40`; `StatCardBody.tsx:73` |
| m13 | "New this period" compares a midnight-cast date column with a time-of-day boundary, so a record exactly `periodDays` old is excluded until next midnight; the attendance window start is UTC while `attendance.date` is workspace-local. | `studentRepositoryListMetrics.ts:17,26-28`; `attendanceRepositoryMetrics.ts:27` |
| m14 | The unpaid-invoice notification is gated on finance **write**, so a read-only finance role never sees it — the only notification using write rather than read as visibility. | `lib/buildDashboardNotifications.ts:71` vs `:72,74-77` |
| m15 | For `sum`/`avg` widgets the same filtered aggregate runs twice (value, then grouped chart) although one `GROUP BY` yields both; a prior audit removed the *count* chart but not this duplication. | `studentRepositoryWidgetsAggregate.ts:68-92` and `:110-127`, same `whereClause` |

## 5. Test gaps

- **T1 (per-user isolation).** No spec asserts user B's preferences survive user A's `PUT` — because the production
  behaviour is shared. A design gap, not merely untested; the guard belongs with the D1 fix (two-session round-trip).
- **T2 (partial PUT).** `dashboardSetup.integration.test.ts:123,142` exercises the exact D3 payload but stubs the
  service (`:38-42`). Missing: a real-store test that `PUT {gridMode}` preserves `disabledCardIds`/thresholds.
- **T3 (frontend authorization).** No spec covers `useDashboardData`'s `shouldLoad*` matrix or D5's card filtering;
  `useDashboardSetupConfig.test.tsx` asserts only instantiation, normalization and invalidation.
- **T4 (write concurrency).** No spec exercises two overlapping preference mutations (`onMutate`/rollback absent) or
  the threshold on-change debounce.
- **T5 (`StatisticsGrid`).** The single test covers the loading skeleton only — no empty-state, edit-mode, `aria-busy`
  or `onResetCards` coverage.
- **T6 (mutation failure contract).** `deleteWidget`'s status is unchecked; no test asserts a 403 toast/no cache
  change. Only reorder has an error-path test.
- **T7 (real DB).** `dashboardRepository.test.ts` mocks `withTenant` and asserts query *shape*; no `test:db`/`test:rls`
  case covers `dashboard_preferences`/`dashboard_widgets` tenant isolation, the singleton upsert race, or D4's `22001`.
- **T8 (seed).** No dashboard-suite coverage for the localStorage→server seed effect or its cross-tenant key (m4);
  `apps/frontend/src/hooks/useDashboardConfig.test.tsx` exists but was not inspected in this pass.

## 6. Verified-clean surfaces

- **Route classification and gate.** `registerModuleAccess(fastify, "dashboard")` runs after `authenticateTenant` and
  stamps every contract route via `onRoute`; `/api/dashboard/*` resolves to `availability` (`moduleRouteActions.ts:41-46`)
  and the prefix is classified in `moduleAccessCoverage.test.ts:31`.
- **Handler-level write authorization.** Every mutating route goes through `handleDashboardWrite` → `canWriteDashboard`
  (`setupWrite` **or** `customize`), pinned by `dashboardSetup.integration.test.ts` (teacher 403 on
  prefs/widgets/delete/reorder, admin 200).
- **No stale-token escalation.** `authenticateTenant` replaces the JWT role with the authoritative matrix role before
  handlers (`middleware/authenticate.ts:157-163`), so `roleHasPermission(user.role, …)` in the route is not stale.
- **Cross-module summary filtering is real and pinned.** `pickReadableModuleSections` drops sections whose module read
  permission is missing and fails closed for unknown keys (`requireTenantModule.ts:100-124`);
  `moduleAccessGuard.integration.test.ts:205-216` proves a teacher's summary keeps only `students` and strips
  `finance`/`accounting`/`hasanat`.
- **SQL injection.** No user string reaches `sql.raw`: finance maps through `FIELD_TO_SQL_COLUMN[field] ?? "status"`
  (`financeRepositoryWidgets.ts:22-25`); students uses explicit branches with unknown → `sql\`''\``
  (`studentRepositoryWidgetsSql.ts:24-96`); filter values are bound parameters.
- **Tenant predicate.** Every dashboard table/join is scoped by `workspace_subdomain` on both sides; reorder is
  `and(eq(ws), inArray(id))`; the summary runs inside `withTenant(cleanTenant, …)`.
- **Bounded work.** Explicit column maps (no wildcard projections); widget list limit clamped 1..500 (default 200);
  `chartLimit` clamped 1..50; `widgetAggregatesBodySchema` `.max(32)`; `putWidgets` `.max(500)`; summary TTL 30 s.
- **Statement timeouts.** Reads 5 000 ms (`dashboard.ts:54-55`), summary 10 000 ms (`dashboardSummaryService.ts:93`),
  writes inherit `PG_STATEMENT_TIMEOUT_MS` (default 30 s) via `applyTenantTransactionGuards`
  (`tenantTransactionGuards.ts:28`).
- **No fan-out storm on the happy path.** `/metrics` fallbacks are gated on `canFallback && !summary?.<section>`
  (`useDashboardData.ts:160-186`); the widget fan-out is the documented bounded case (`docs/db-performance-audit.md:30-31`).
- **Optimistic reorder is correct.** The only mutation with `onMutate` snapshots and restores on error and re-sorts the
  cache (`useDashboardSetupConfig.ts:145-185`).
- **300-LOC cap and `any`.** Largest dashboard file 249 LOC (`DashboardPage.tsx`); no explicit `any` in the feature tree.
- **i18n.** All 91 `t()` keys used in the dashboard tree resolve in `appTranslationsEn/Ar/Ur/Fa`; no hardcoded
  user-facing strings in the components reviewed.

## 7. Adversarial audit

**Edge cases.** A title beyond `varchar(255)` or a `category` beyond 64 reaches Postgres unvalidated (D4). A body
containing only `gridMode` is valid and resets everything else (D3). `?date=zzz` becomes both a cache key and a cache
miss (m2); the attendance aggregation's `DATE_RE` keeps it out of SQL, so this is amplification, not injection. A
zero-widget workspace seeds from the browser's legacy store on the first writer's load (m4). Deleting every widget is
representable — `[]` is truthy in `useDashboardSetupConfig.ts:83`, so the placeholder does not resurface.

**Failure modes.** `handleDashboardRead`, `putPreferences`, `putWidgets`, `deleteWidget` and `reorderWidgets` swallow
the cause and answer 500 with no log (m3), so a dashboard write regression is invisible in production logs. The
preferences mutation has no optimistic update and no rollback, so a failed write leaves the UI on the last server value
with a toast — correct, but the click→response window is where D2 loses edits. A Redis write failure falls back to the
bounded in-memory store rather than throwing (`redisCacheOperations.ts:26-60`), so a cache outage degrades to recompute,
not to a 500.

**Security / multi-tenancy.** No cross-tenant path was found: the summary cache key is tenant-scoped, the section filter
is permission-scoped, and every dashboard table statement carries the tenant predicate. Unknown section keys fail closed
(`getModuleAvailabilityDenial` → `MODULE_NOT_GRANTED` for an unresolvable id), so a future section cannot leak by
omission. Residual boundary concerns are within-tenant (D1: one colleague overwrites another's layout) and browser-local
(m4/m5: storage keys are not tenant-scoped).

**Concurrency.** Preferences are a last-write-wins document with no version, no `SELECT … FOR UPDATE`, and a client-side
read-modify-write whose base comes from a render closure (D2): two admins editing at once, or one admin double-toggling,
lose an edit silently. Widget reorder is the one dashboard write with an optimistic snapshot/rollback and it deduplicates
ids before building its `CASE`. `upsertDashboardWidgetsForWorkspace` deduplicates by `id` (last wins) and deliberately
does not delete absent rows, so a partial PUT cannot destroy the widget set; `deleteDashboardWidgetById` is scoped by
`(workspace, id)` and idempotent.

## 8. Resolution plan

**Tier 1 — land with the next dashboard change (no product decision needed).**

| Finding | Change | Guard |
| --- | --- | --- |
| D2 | `onMutate` optimistic `setQueryData` + rollback for preferences; derive the next value from the query cache; debounce threshold inputs | two overlapping toggles end with both cards hidden; a failed PUT rolls back |
| D3 | Merge the body over the stored row (read-modify-write in one transaction) before normalizing | `PUT {gridMode}` preserves `disabledCardIds` + thresholds against a real store |
| D4 | Mirror column limits in `customWidgetSchema`; cap/reject oversized `config`; log the catch | a 300-char title answers 400, not 500 |
| D5 | Filter metric cards with `isDashboardWidgetAllowed(widget, enabledModules, can)` | role without `finance.read` renders no finance card |
| m1–m3, m9–m10 | Enforce or delete the `analytics.view` claim; validate/limit `date`; log 500s; delete the dead API facade; cap `reorderWidgets` | route/contract tests |

**Tier 2 — per-user state and the remaining minors.**

| Finding | Change | Guard |
| --- | --- | --- |
| D1 | Per-user preferences key (`userId`) + explicit widget scope; migrate the singleton row to the workspace default; set the customize gate to the declared permission | two-user isolation test through the real handler |
| m4–m8, m11–m15 | Tenant-scope browser storage keys; `aria-busy`/`role="status"` on the loading grid; focus move/return for the builder; AND the setup-completeness check; chunk widget aggregates to 32 and check status; separate percentage-point from percent trends; align metric windows to workspace-local dates; finance read for the notification; single `GROUP BY` for sum/avg | the T2–T8 specs in §5 |

**Product decision — shared vs personal dashboard.** The schema comment states the singleton was chosen deliberately
during the document-store migration, so D1 may be a product stance rather than a regression. Decide explicitly:
(a) *personal* → implement Tier-2 D1 and keep the customize permission as declared; or (b) *shared workspace board* →
say so in `dashboardModuleManifest.ts`, require `settings.global.write` for all customize writes, label the controls as
workspace-wide, and reduce D1 to a documentation change. Either way D2/D3 stay in scope: lost updates are a defect under
both models.

## 9. Hypotheses not proven

- **Intent of the workspace singleton.** The schema comment and factory show it is deliberate *as implemented*; whether
  per-user isolation was dropped unintentionally during the migration is undocumented. D1's severity depends on that.
- **m4 in practice.** The cross-tenant seed needs one browser, two workspaces, a writer in each, and a widget-less target;
  real-world frequency is unmeasured.
- **D4's reachability from the UI.** The API path is proven; whether `WidgetBuilderOptionsPanel` independently caps the
  title length was not read, so the UI path is unverified.
- **m15's cost.** No `EXPLAIN` on production-cardinality data; the duplicated aggregate is visible in the SQL construction
  but its wall-clock impact is unmeasured.
- **`apps/frontend/src/hooks/useDashboardConfig.test.tsx` contents** — not inspected in this pass; T8 may be partially
  covered.
- **Playwright/axe and `test:db`/`test:rls`** were not run, so m6/m7 and T7 remain static observations and no visual,
  RTL or runtime regression is claimed.
- **External consumers of `GET /api/dashboard/preferences`** expecting per-user values — none was found beyond the
  dashboard hook, though the endpoint is readable by any authenticated tenant user by design.

## 10. Implementation status (2026-11-04)

| ID | Status | Change | Guard |
| --- | --- | --- | --- |
| D2 | **Fixed** | Preferences mutation has an optimistic `onMutate` with rollback, `updatePref` reads the latest cached document, and thresholds commit on blur instead of per keystroke | `dashboardSetup.integration.test.ts` partial-PUT case + hook path |
| D3 | **Fixed** | `PUT /preferences` merges the body over the stored document before normalizing, so an omitted key is preserved | `dashboardSetup.integration.test.ts` asserts stored `disabledCardIds`/thresholds survive |
| D4 | **Fixed** | Widget DTO mirrors the indexed varchar limits and caps the jsonb remainder (400 instead of `22001`→500) | shared schema |
| D5 | **Fixed** | Metric cards are filtered with `isDashboardWidgetAllowed(widget, enabledModules, can)`, matching pinned widgets | controller call site |

Still open (Tier 1 exclusion): **D1** — prefs/widgets remain a workspace singleton pending the shared-vs-personal product decision; remaining minors in §4.
