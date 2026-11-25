# MMS Dashboard Module Review — 2026-11-17

Independent, read-only re-review of the dashboard surfaces at `main` (`86c76750f`, working tree clean at
review time). This supersedes [dashboard-module-review-2026-11-04.md](dashboard-module-review-2026-11-04.md):
it re-verifies every prior finding (D1–D5, m1–m15) against the current tree, surfaces new findings from the
commits landed since (`bdf5ce4f7` "close Tier 1 findings", `13b7bf5ac` migration 0205 + schema hardening,
`c19068cba` OCC enforcement elsewhere, `36ec41324` dashboard bundle skeleton), and performs a **first review of
the platform-console dashboard**.

Scope: tenant dashboard (`apps/frontend/src/tenant/features/dashboard/**`, `apps/frontend/src/hooks/useDashboardConfig.ts`,
`apps/frontend/src/lib/dashboard*`, `tenant/hooks/collections/dashboard.ts`, backend
`routes/tenant/dashboard.ts` + its services/repositories/schema, `packages/contracts/src/dashboard/**`,
`contracts/dashboard.contract.ts`) **plus** the platform dashboard (`apps/frontend/src/platform/**` dashboard
components/hooks, `apps/backend/src/services/platform/**`, `routes/platform/**`, `workspacePresentationService.ts`),
with the cross-cutting access files (`moduleRouteActionRules.ts`, `requireTenantModule.ts`, `moduleAccessPolicy.ts`,
`moduleAccessCoverage.test.ts`, `routeAccess.test.ts`, apex route registry).

## 1. Baseline evidence

| Check | Result |
| --- | --- |
| `pnpm typecheck` (shared, ui, backend, frontend, e2e) | Pass — 6/6 packages (turbo, cached) |
| Backend `dashboard` + `moduleAccess` + `platformTelemetry` suites | **68 passed** (9 files) |
| Frontend `dashboard` suite (incl. platform dashboard tests) | **170 passed** (37 files) |
| Frontend `routeAccess` + apex route registry | **17 passed** (3 files) |
| `moduleAccessCoverage.test.ts` | 1 / 1 passed |

Method was static plus the suites above: every in-scope file was read and each query traced contract →
ts-rest handler → service → repository → Drizzle statement. No Playwright/axe pass and no `test:db`/`test:rls`
run; runtime/visual claims are confined to §7.

## 2. Verdict

The Tier-1 fixes from the prior review **are genuinely landed and tested**: partial-PUT merge (D3), widget DTO
limits (D4), permission-aware metric cards with an `unavailable` render state instead of a fake zero (D5), ISO
`date` validation (m2), handler logging (m3), tenant-scoped browser storage (m4/m5), `aria-busy` + empty-state
(m6), the dead API facade trimmed (m9), the reorder array bounded (m10), and the preferences write moved to
optimistic `onMutate` + commit-on-blur (D2, frontend half). No authorization *escalation* was found on the tenant
dashboard: RLS is forced on both tables, every statement carries the tenant predicate, and the summary is
section-filtered by permission.

Two headline issues remain. **First**, the tenant dashboard is still a **workspace-wide singleton with no
optimistic-concurrency control** — the deliberate "shared board" stance is now documented in the route, but the
customize gate is still `configuration.view` (settings *read*) rather than the `settings.global.write` the prior
review required for a shared board, and concurrent writers still last-write-wins on the whole document (D1 + the
D2 server half). **Second**, the platform dashboard has two Major defects introduced by its own (previously
unreviewed) surface: a client-side date filter applied *after* pagination (P1) and workspace-admin reset/create
gated one level below the delete control (P2).

## 3. Prior-finding status

| ID | Prior sev | Status | Evidence / note |
| --- | --- | --- | --- |
| D1 workspace-global prefs/widgets | Major | **Open** | PKs still `workspaceSubdomain` (`db/schema/dashboard.ts:20-26,53`); route comment now states the shared stance (`routes/tenant/dashboard.ts:246-250`); customize gate still `configuration.view` (`useDashboardConfig.ts:62-64`) |
| D2 stale read-modify-write | Major | **Partially fixed** | FE fixed: `latestPrefsRef` + optimistic `onMutate` + commit-on-blur (`useDashboardConfig.ts:81-156`, `useDashboardSetupConfig.ts:79-115`, `DashboardAlertThresholdsSection.tsx:32-83`); server half (OCC/409) still missing → N1 |
| D3 partial PUT wipe | Major | **Fixed** | load → merge → normalize (`routes/tenant/dashboard.ts:63-69`) |
| D4 widget DTO vs varchar | Major | **Fixed** | `.max(255/64/32)` + 16 KB `config` refine (`dashboardWidgetSchema.ts:42-84`) |
| D5 zero-valued forbidden cards | Major | **Fixed** | `isDashboardWidgetAllowed` filter (`useDashboardMetricCards.ts:43-45`) + `unavailable`→`—` render (`buildDashboardMetricCard.ts:111-112`, `StatisticsGrid.tsx:123-132`) |
| m1 `analytics.view` unenforced | Minor | **Open** | manifest `read: analytics.view` (`dashboardModuleManifest.ts:19`); `availability` short-circuits with no permission check (`moduleAccessPolicy.ts:190`); role ignored (`dashboard.ts:225-231`) |
| m2 raw `date` cache key | Minor | **Fixed** | `date: z.iso.date().optional()` (`contracts/dashboard.contract.ts:120-127`) |
| m3 silent 500s | Minor | **Fixed** | every handler `request.log.error`/`logger.error` (`dashboard.ts:89,131,177,209,233`) |
| m4 cross-tenant seed blob | Minor | **Fixed** | `scopedStorageKey` + `WeakSet<QueryClient>` guard (`widgetDefaultsStore.ts:150,163,172`, `useDashboardConfig.ts:38,88-124`) |
| m5 tenant-agnostic dismissal | Minor | **Fixed** | workspace prefix + `_u:${userId}` (`NotificationsPanel.tsx:28-30`, `SetupIncompleteCallout.tsx:32-34`) |
| m6 loading a11y | Minor | **Fixed** | `aria-busy` + `sr-only` heading + empty-state (`StatisticsGrid.tsx:44-90`) |
| m7 builder focus | Minor | **Partially** | focus-in via `tabIndex=-1` + `node.focus()` (`DashboardCustomizePanel.tsx:53-66`); no focus-return to trigger on close |
| m8 OR completeness | Minor | **Open** | `logoUrl \|\| country \|\| email \|\| phone \|\| tagline` (`SetupIncompleteCallout.tsx:19-27`) |
| m9 dead API facade | Minor | **Fixed** | single `fetchDashboardSummaryAsync`, consumed by `useDashboardSummaryQuery.ts:13,34` |
| m10 unbounded reorder | Minor | **Fixed** | `order.max(500)`, `sortOrder.int().min(0).max(1_000_000)` (`contracts/dashboard.contract.ts:98-107`) |
| m11 no 32-chunking | Minor | **Open** | one request, `res.body?.results ?? {}` with no status check (`useStudentsAnalyticsQueries.ts:96-114`); server cap `max(32)` (`schemas/common.dto.ts:51`) |
| m12 trend semantics | Minor | **Open** | attendance points-delta vs %-change both through `formatPercent` (`dashboardMetricTrends.ts:35-37`, `StatCardTrend.tsx:21-26`) |
| m13 timezone boundary | Minor | **Partially** | students now `NOW() - interval` timestamptz (`studentRepositoryListMetrics.ts:17,25-28`); attendance still UTC `toISOString` (`attendanceRepositoryMetrics.ts:24-28`) |
| m14 finance-write gate | Minor | **Open** | `can(FINANCE_MODULE_MANIFEST.permissions.write)` (`buildDashboardNotifications.ts:71`) |
| m15 duplicate sum/avg | Minor | **Open** | scalar aggregate + grouped chart run the same expressions (`studentRepositoryWidgetsAggregate.ts:62-81,94-126`) |

## 4. New findings — tenant dashboard

### N1 — Minor — Preferences write has no optimistic-concurrency control

**Evidence.** The preferences upsert is a plain `insert … onConflictDoUpdate { preferences, updatedAt }` with no
`version`/`updatedAt` precondition and no 409 (`moduleSetupRepoSingletonJson.ts:99-118`); the route merges
`{...stored, ...body}` across two separate statements (`routes/tenant/dashboard.ts:63-69`). The OCC pattern landed
for sibling modules in `c19068cba` was **not** applied here; neither dashboard table has a `version` column.

**Production path.** Two admins (or an admin and a principal, both holding `configuration.view`) write within one
round-trip: `load` returns the same base, each `save` overwrites the other.

**Consequence.** Lost updates on a workspace-wide document (compounds D1). Blast radius is low (singleton, writers
only), but the failure is silent and unrecoverable.

**Proposed fix.** Add a `version` (or reuse `updatedAt`) and do a compare-and-set upsert returning 409 on conflict;
surface the conflict to the client. At minimum, run load→merge→save inside one `SELECT … FOR UPDATE` transaction.

### N2 — Minor — Soft-delete restore/find path is unwired

**Evidence.** `restoreDashboardWidget` (`lib/dashboardWidgetsService.ts:46-49`),
`restoreDashboardWidgetById` and `findDashboardWidgetById`
(`db/repositories/dashboardWidgetsRepository.ts:145-181,184-203`) have no route — the contract
(`contracts/dashboard.contract.ts`) exposes no restore endpoint.

**Consequence.** A soft-deleted widget (`DELETE /api/dashboard/widgets/:id` → `deleted_at` set via migration 0205)
is unrecoverable through the API; only the whole-workspace backup-restore path can resurrect it. Dead code invites
drift.

**Proposed fix.** Wire a `POST /api/dashboard/widgets/:id/restore` (gated like delete) or delete the dead
functions and rely on backup-restore explicitly.

### N3 — Minor — Widget `config` is bounded per-widget, not per-request

**Evidence.** `customWidgetSchema.passthrough()` (`dashboardWidgetSchema.ts:79`) sends arbitrary keys into `config`
jsonb, capped only by the 16 KB per-widget refine (`:82-84`); `dashboardWidgetsPutBodySchema` allows
`DASHBOARD_WIDGETS_MAX` (500) such widgets.

**Consequence.** Up to ~8 MB of jsonb per PUT (vs the single-widget 16 KB ceiling the refine implies). No
correctness/security issue; the effective request ceiling is governed only by Fastify's body limit.

**Proposed fix.** Add an aggregate payload cap or an explicit `config` schema.

## 5. New findings — platform dashboard (first review)

### P1 — Major — Fleet date filter is client-side, applied after pagination

**Evidence.** `usePlatformWorkspaces` accepts only page/limit/search/status/sort (`usePlatformWorkspaces.ts:26-33`);
`PlatformDashboardFleet` filters the *already-paginated* page by date
(`PlatformDashboardFleet.tsx:42-66,77-82`).

**Production path.** Fleet dashboard → set a date range → results only shrink within the current 5-row page;
pagination `total` and "select all" ignore the range.

**Consequence.** Silently wrong results and broken export/select-all.

**Proposed fix.** Pass `dateFrom`/`dateTo` to the API and filter server-side before pagination (extend
`platformWorkspacesListQuerySchema`), or drop the control. Guard: a spec asserting `total` reflects the range.

### P2 — Major — Workspace-admin reset/create gated below the delete control

**Evidence.** `deleteWorkspace` is `super_user`-only (`platformWorkspaces.ts:62-76`), but
`resetWorkspaceAdminPassword` and `createWorkspaceAdminUser` inherit only the plugin-level `workspaces` gate
(`platformWorkspaces.ts:46-61`); the contract returns a plaintext `newPassword`
(`platformWorkspaces.contract.ts:128-167`).

**Production path.** A `workspaces`-only admin can reset or create any tenant admin and receive the plaintext
password — full tenant account takeover, a capability broader than "list/enable/disable/configure"
(`platformTypes.ts:23`).

**Consequence.** Privilege surface inconsistent with the delete control. *(Adjacent surface — workspace-admin
routes — surfaced by the platform dashboard's fleet/quick-action flows.)*

**Proposed fix.** Require `super_user` for both (matching delete) or add an explicit, documented permission; add
coverage proving a `workspaces`-only admin is rejected.

### P3 — Minor — Zero-permission admin sees a perpetual skeleton

**Evidence.** Dashboard route is `permission: null` (`apexRouteRegistry.ts:44-48`); metrics/trend queries are
`enabled:false` for that user, so `metricsReady` is false and it falls into `<StatsSkeleton count={3}/>`
(`PlatformDashboard.tsx:31-36,107-109`).

**Consequence.** A default admin (no grants) lands on an infinite loading spinner, not a "no access" state.

**Proposed fix.** When authenticated but `!canWorkspaces`, render a permission-gated `EmptyState`; add a spec.

### P4 — Minor — Fleet list does an unbounded full-table scan + in-memory sort

**Evidence.** `listWorkspaceRowsWithBranding()` selects every workspace/branding row
(`workspaceBrandingRepository.ts:16-51`); filter/sort/slice happen in JS
(`workspacePresentationService.ts:128-137`).

**Consequence.** O(N) load + sort per fleet page load. *(Hypothesis: acceptable at platform scale today; degrades
as workspace count grows.)*

**Proposed fix.** Push search/status/sort/pagination into SQL (`WHERE`/`ORDER BY`/`LIMIT`/`OFFSET`).

### P5 — Minor — Fleet "export selected" is a no-op stub

**Evidence.** Confirm only `notify.success(...)` and clears selection — no export/queue call
(`PlatformDashboardFleet.tsx:117-128`).

**Consequence.** UI claims "export queued" but nothing is queued.

**Proposed fix.** Wire a real export mutation/queue or remove the control until implemented.

### P6 — Minor — Hardcoded English month labels

**Evidence.** Frontend fallback `"Jan"…"Jun"` (`PlatformDashboardCharts.tsx:54-59`); backend generates labels with
`toLocaleString("en-US", …)` (`platformActivityLogsRepository.ts:130`).

**Consequence.** ar/ur/fa console users see English month names on the trend axis.

**Proposed fix.** Return `yearMonth` and format client-side via i18n (or localize server-side with the request locale).

### P7 — Minor — Charts not screen-reader accessible; loading lacks live announcements

**Evidence.** Recharts `Bar`/`Area` render no `role="img"`/`aria-label`/text alternative
(`PlatformDashboardCharts.tsx:72-133`); skeleton has no `aria-busy`/`role="status"` (`PlatformDashboard.tsx:108`).

**Consequence.** Chart data and loading transitions are not announced.

**Proposed fix.** Add an accessible summary (`role="img"` + `aria-label` or a visually-hidden table) and
`aria-busy`/`role="status"` on loading regions.

### P8 — Minor — `rlsIsolation: "enforced"` is a hardcoded literal

**Evidence.** `getPlatformTelemetry` returns the constant `"enforced"` (`platformTelemetryService.ts:69`),
presented as live health data.

**Consequence.** False confidence if RLS were ever disabled; misleading diagnostic.

**Proposed fix.** Derive from a real probe (e.g. `SHOW row_security`) or relabel as a configuration assertion.

### P9 — Minor — No server-side telemetry caching (DB ping per poll)

**Evidence.** `getPlatformTelemetry` runs `pingDatabase()` (`SELECT 1`) per call
(`platformTelemetryService.ts:53-55`); frontend defaults to a 30 s poll (`usePlatformTelemetry.ts:88`).

**Consequence.** *(Hypothesis: modest load per operator;)* no shared TTL across concurrent viewers.

**Proposed fix.** Add a short server-side TTL cache (5–10 s).

## 6. Verified-clean surfaces

- **Module access gates.** `registerModuleAccess(fastify, "dashboard")` after `authenticateTenant`
  (`dashboard.ts:253-254`); `/api/dashboard` classified in `moduleAccessCoverage.test.ts:31` (passing).
- **RLS + tenant isolation.** `FORCE ROW LEVEL SECURITY` + `tenant_isolation_policy` on both tables
  (`0062_dashboard_preferences_widgets.sql:15-24,45-54`); every repository statement scopes
  `workspaceSubdomain` after `trim().toLowerCase()`; no cross-tenant path found.
- **No SQL injection.** Zero `sql.raw`; field/operator resolution is a fixed whitelist, unknown fields collapse
  to `sql\`''\`` (`studentRepositoryWidgetsSql.ts:21-88`); filter values are bind parameters; reorder `CASE` arms
  parameterized (`dashboardWidgetsRepository.ts:124-131`).
- **Summary section filtering fail-closed.** `pickReadableModuleSections` strips sections whose module read
  permission is missing; `moduleAccessGuard.integration.test.ts` proves a teacher keeps only `students`.
- **Authoritative role.** `authenticateTenant` replaces the JWT role with the matrix role before handlers, so no
  stale-token escalation.
- **Bounded work.** Explicit projections (no `select *`); list cap 500; read timeout 5 000 ms
  (`dashboardRouteHelpers.ts:29`), summary 10 000 ms (`dashboardSummaryService.ts:120`); widget `config` capped
  16 KB/widget; chart `limit` clamped; reorder bounded.
- **Soft-delete correctness.** Sextuple columns + `trg_dashboard_widgets_forbid_hard_delete` + partial indexes on
  `deleted_at IS NULL` (`0205_dashboard_schema_hardening.sql`, `db/schema/dashboard.ts:54-59`).
- **Frontend state.** TanStack Query authoritative with `hasServerData` vs placeholder distinction; optimistic
  reorder snapshots/rolls back; preferences mutation cancels + restores on error.
- **Tenant-scoped browser storage** (`scopedStorageKey` via `tenantLocalStoragePrefix(subdomain)`).
- **i18n** — all dashboard-tree strings use `t()`; no hardcoded user-facing copy found in the tenant tree
  (platform charts aside, P6).

## 7. Adversarial audit

**Edge cases.** 33+ aggregate widgets in one collection exceed the server's 32 cap and silently degrade to
zero-valued widgets (m11 — no chunking, no status check). A 300-char widget title now answers 400 (D4). A
partial `{gridMode}` PUT preserves stored thresholds (D3). A 500-widget PUT can carry ~8 MB of `config` jsonb (N3).
The fleet date filter returns page-bound results (P1). A zero-permission admin hits a perpetual skeleton (P3).

**Failure modes.** "Export selected" is a no-op but reports success (P5). Soft-deleted widgets are unrecoverable
via API (N2). A telemetry DB ping runs every 30 s per viewer with no shared cache (P9). The preferences merge is
non-transactional load→save, so concurrent writers lose updates (N1). `dashboardSetup.integration.test.ts` mocks
every service, so RLS/reorder/soft-delete/merge behavior is not exercised against Postgres.

**Security / multi-tenancy.** No tenant cross-contamination found on the dashboard tables; the summary cache key is
tenant-scoped and section-filtering fails closed. Residual concerns are: D1 (colleague overwrites the shared
layout), m1 (`analytics.view` is dead), and — on the platform side — P2 (workspace-admin reset/create gated one
level below delete, returning plaintext passwords). P2 is the only finding with a genuine privilege-boundary
question; it is an adjacent route surfaced through the platform dashboard review, not a dashboard-table issue.

**Concurrency.** Preferences are last-write-wins with no version/409 (N1); the frontend optimistic merge fixes
single-user rapid toggles but not cross-user races. Widget reorder is optimistic and idempotent; upsert dedupes by
id and never deletes absent rows. The `updatedAt` echo exists on the row but is not used as a write precondition.

## 8. Resolution plan

**Tier 1 — land with the next dashboard/platform change (no product decision needed).**

| Finding | Change | Guard |
| --- | --- | --- |
| P1 | Server-side `dateFrom`/`dateTo` filter before pagination (or remove the control) | spec: `total` reflects the range |
| P2 | Require `super_user` (or an explicit permission) for reset/create-workspace-admin | spec: `workspaces`-only admin rejected |
| N1 | `version`/`updatedAt` compare-and-set with 409 (or `SELECT … FOR UPDATE`) | concurrency spec |
| m11 | Chunk aggregate widgets to 32 and check the response status | spec: 33 widgets → 2 requests, error surfaced |
| P3, P5 | Permission-gated `EmptyState` instead of skeleton; wire or remove export | spec per branch |
| N2 | Wire restore endpoint or delete dead functions | route/contract test |

**Tier 2 — product decision + remaining minors.**

| Finding | Change | Guard |
| --- | --- | --- |
| D1 | Decide personal vs shared; if shared, require `settings.global.write` and label controls workspace-wide; else add `userId` to keys | two-user isolation round-trip |
| m1 | Enforce `analytics.view` on `/summary` in-handler, or drop the declaration | route test |
| m8 | AND the completeness check (require logo + country + one contact field, or a deliberate threshold) | unit test |
| m12 | Separate percentage-point from percent-change in the trend chip | render test |
| m13 | Workspace-local time boundaries for attendance window | repo test |
| m14 | Gate the unpaid-invoice notification on finance **read** | unit test |
| m15 | Derive the scalar from the grouped `chartData` (Σ sums / Σ counts) | repo test |
| N3 | Aggregate payload cap or explicit `config` shape | schema test |
| P4, P6–P9 | SQL pagination; i18n month labels; chart a11y + `aria-busy`; real RLS probe; telemetry TTL cache | unit/integration tests |

## 9. Hypotheses not proven

- **P2 intent** — reset/create-workspace-admin may be deliberate break-glass support; it is undocumented, so the
  escalation is treated as a defect until stated otherwise.
- **P4 impact** — the unbounded fleet scan is unmeasured at production workspace cardinality.
- **N1/D1 blast radius** — concurrent dashboard writers are assumed rare; no telemetry quantifies it.
- **P7 and m7-focus-return** are static observations; no axe or keyboard-manual pass was run.
- **`test:db` / `test:rls`** were not executed, so RLS/soft-delete/trigger behavior is asserted by code reading and
  the passing unit/integration suites, not a live-DB round-trip.

## 10. Implementation status

Fixes from the prior review (§3) are landed and green under the suites in §1. The remaining open items are D1,
the D2 server half (N1), m1, m7-focus-return, m8, m11, m12, m13 (attendance), m14, m15, and the new N2/N3 plus the
platform findings P1–P9. Nothing in §4–§5 blocks the dashboard from shipping, but P1 and P2 should be addressed
before the platform dashboard is treated as production-complete.
