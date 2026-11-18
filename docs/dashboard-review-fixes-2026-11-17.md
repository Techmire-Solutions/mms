# Dashboard Review Fixes — 2026-11-17

Consolidated record of every fix landed in response to
[dashboard-module-review-2026-11-17.md](dashboard-module-review-2026-11-17.md). All findings from that
review are now resolved. Base tree was `86c76750f` (clean at start of session).

## Verification summary

| Check | Result |
| --- | --- |
| `pnpm typecheck` (shared, ui, backend, frontend, e2e) | 6/6 packages pass |
| Backend targeted suites (`dashboard`, `moduleAccess`, `platformTelemetry`, `platformRouteSecurityMatrix`, `workspacePresentationService`, `attendanceRepositoryMetrics`) | 78 passed |
| Frontend `dashboard` suite | 175 passed (38 files) |
| Shared suites (`moduleAccessPolicy`, `appTranslations`, `dashboardWidgetSchema`) | 18 passed |
| `check:i18n` / `check:i18n-unused` | pass (locales complete; unused-key ratchet held) |
| `check:code-norms` / `check:shared-purity` / `check:shared-structure` / `check:db-projections` / `check:backend-boundaries` / `check:frontend-structure` | all pass |

DB-backed suites (`test:db`/`test:rls`) and Playwright/axe remain out of scope, consistent with the review's method.

---

## Tenant dashboard

| Finding | Change | Guard |
| --- | --- | --- |
| **D1** | Workspace-wide board kept (per decision); `customize` tightened `configuration.view` → `settings.global.write`; customize panel labels the board as workspace-wide | `dashboardSetup.integration.test.ts` — principal (settings read, no global write) → 403 |
| **m1** | Investigated as dead but **reverted**: `read: analytics.view` is the frontend Home-visibility gate (`canShowRoute`), not the backend summary gate — dropping it hid Home from non-`analytics.view` roles. Manifest keeps `read: analytics.view`; `ModulePermissionSource.read` stays required | `routeAccess.test.ts` (teacher→Home, guardian→hidden) |
| **m7** | Widget-builder focus returns to the opener on close | manual keyboard path |
| **m8** | `isInstitutionProfileComplete` now requires logo **and** a contact field (no single-field false positive) | `SetupIncompleteCallout.test.ts` |
| **m11** | Widget aggregates chunk to ≤32 with error-check (no silent zero-valued overflow) | `widgetAggregatesBatch.test.ts` |
| **m12** | Attendance trend renders as percentage-points (`pp`) vs percent (`%`) | `StatCardTrend.test.ts`, `buildDashboardMetricCard.test.ts` |
| **m13** | Attendance `selectedDate`/`periodStart` computed in workspace timezone | `attendanceRepositoryMetrics.test.ts` (Karachi vs UTC) |
| **m14** | Unpaid-invoice / fees-clear notifications gate on `finance.read`, not write | `buildDashboardNotifications.test.ts` |
| **m15** | Accepted as bounded two-pass; guard comment added (scalar can't derive from `chartLimit`-truncated chart) | comment |
| **N1** | Preferences write uses optimistic compare-and-set on `updated_at` → 409 on stale | repo CAS + route 409 + `useDashboardConfig` single-flight tests |
| **N2** | Removed dead `restoreDashboardWidget`/`restoreDashboardWidgetById`/`findDashboardWidgetById` | `dashboardRepository.test.ts` trimmed |
| **N3** | Widget PUT payload capped at 512 KB request-level | `dashboardWidgetSchema.test.ts` |

## Platform dashboard

| Finding | Change | Guard |
| --- | --- | --- |
| **P1** | Fleet date range filtered server-side (before pagination) | `workspacePresentationService.test.ts` |
| **P2** | `reset-admin-password` / `create-admin-users` require `super_user` (match delete) | `platformRouteSecurityMatrix.test.ts` |
| **P3** | Zero-permission admin sees a no-access empty state, not a perpetual skeleton | `PlatformDashboard.test.tsx` |
| **P4** | Fleet search/status/date/sort/pagination pushed into SQL (`listWorkspaceRowsPage`) | `workspacePresentationService.test.ts` |
| **P5** | Removed the no-op "export selected" affordance + dead i18n keys | `PlatformDashboardFleetTable.test.tsx` |
| **P6** | No-data trend fallback generated dynamically (no hardcoded Jan–Jun); English is by-design (platform apex) | `PlatformDashboardCharts.test.tsx` |
| **P7** | Charts wrapped `role="img"` + `aria-label`; loading region `role="status"` | `PlatformDashboard.test.tsx` |
| **P8** | `rlsIsolation` relabeled `"schema-enforced"` (static assertion, not a live probe) | telemetry type + tests |
| **P9** | Telemetry gets a 5 s server-side TTL cache (one DB ping per window) | `platformTelemetry.integration.test.ts` |

## Shared / contract

- `dashboardModuleManifest.ts` — `customize` → `settings.global.write`; `read` retained (`analytics.view` gates Home).
- `moduleAccessPolicy.ts` — no change to the permission model (m1 revert).
- `dashboardPreferencesTypes.ts` + `contracts/dashboard.contract.ts` — `updatedAt`/`expectedUpdatedAt` OCC token; 409 response.
- `dashboardWidgetSchema.ts` — `DASHBOARD_WIDGETS_MAX_JSON_BYTES` request cap.
- `schemas/common.dto.ts` — `WIDGET_AGGREGATES_MAX` extracted/reused.
- `schemas/platform.dto.ts` — `dateFrom`/`dateTo` list query params.
- i18n en/ar/ur/fa — added `dashboard.customizeWorkspaceWide`, `platform.noAccessTitle/Hint`; removed `platform.fleetExport*`.

## Backend (besides the above)

- `dashboardPreferencesRepository.ts` — `getDashboardPreferencesWithUpdatedAt` + `saveDashboardPreferencesCas`.
- `dashboardWidgetsRepository.ts` / `lib/dashboardWidgetsService.ts` — removed dead restore/find.
- `studentRepositoryWidgetsAggregate.ts` — guard comment.
- `workspaceBrandingRepository.ts` — `listWorkspaceRowsPage` + shared projection.
- `platformTelemetryService.ts` — `schema-enforced` + TTL cache.
- `platformWorkspaces.ts` — `requireSuperUser` preHandler.

---

## Not touched (concurrent changeset)

During the session the working tree picked up ~40 unrelated modified files in the
contacts/finance/faculty domain (e.g. `contactWriteContext.ts`, `contactRuntimeDefaults.ts`,
`facultyHydrateUseCases.ts`, `financeCollectUseCases.ts`, `contactRepositorySoftDelete.ts`, and their
frontend/shared counterparts). These are **not part of this dashboard work** and were left untouched.

The full `pnpm test` backend run surfaced **6 failures across 5 files** in that area (e.g.
`facultyHydrateUseCases.test.ts` missing `loadContactsSummaryByIdsForTenant` mock export;
`contactWriteContext.test.ts` `countryCodes` null; `softDeleteDataLayer.test.ts` `restoreContactById`
TypeError) — consequences of that concurrent, in-flight changeset, not of the dashboard fixes.

No code was written to those files; any triage/fix of that changeset is deferred pending explicit
instruction.
