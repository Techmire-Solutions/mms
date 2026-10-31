# MMS Frontend Review — 2026-10-30 (deep pass)

Whole-frontend review of `apps/frontend` and the shared surfaces it owns
(`packages/ui`, `@mms/shared` i18n), covering routing/auth gates, the data &
query layer, accessibility, i18n/BiDi, bundle/render performance, coverage and
test hygiene.

Companion to the earlier same-day pass ([frontend-review-2026-10-30.md](./frontend-review-2026-10-30.md)),
which covered PWA precache, stale-chunk recovery and pre-paint BiDi. That pass's
findings (F-FE-1…5) were re-checked and are still implemented; they are not
re-raised here.

**No Critical findings.** The frontend is structurally mature: fail-closed module
access, complete route-level splitting, zero static heavy-library imports, an
empty axe baseline, zero `any`/`@ts-ignore`, and no source file over the 300-LOC
ceiling. The defects below are correctness, accessibility and i18n gaps that the
existing gates could not see.

---

## 1. Method

Read-only review, then TDD fixes.

Automated evidence (all clean before the fixes):

| Gate | Result |
| --- | --- |
| `pnpm --filter mms-frontend typecheck` | pass |
| `pnpm --filter mms-frontend lint` | pass |
| Full Vitest | 1,024 files · 3,684 passed / 2 skipped |
| `check:code-norms` | 0 `any`, 0 arbitrary-colour expressions, 4 exempt dictionaries |
| `check:frontend-structure`, `check:work-directory`, `check:shared-ui` | pass |
| `check:i18n` | 9,415 keys × 4 locales, 0 missing / 0 EN fallback |
| `check:i18n-unused` | 517 unreferenced (baseline 518) |
| `check:bundle` | 637 chunks · 14.66 MB JS / 4.18 MB gzip (budget 15 MB / 4.5 MB) |
| `check:pwa` | 38 entries · 2.29 MB (budget 50 / 3.5 MB) |

Manual inspection: entry/routing trees, guards, `apiClient` refresh path, live
push dispatcher, query persistence, overlay primitives, i18n resolution, the
entry import closure (from `dist/.vite/manifest.json`), the coverage denominator,
and an import graph over all 3,813 `src` files.

## 2. Fixed in this change

| ID | Severity | Defect | Fix |
| --- | --- | --- | --- |
| F-01 | Major | Pagination labels resolved to literal keys. `ListPagination` built `${ns}.pagination.*` keys and used `t(key) ?? "English"` — but `t()` returns the key when missing, so the fallback never fired and surfaces rendered `common.pagination.range` / `attendance.pagination.summary`. `common.pagination.*` did not exist in any pack. | Added `common.pagination.{label,pageOf,range,summary}` ×4 locales; replaced the dead `??` fallbacks with an explicit namespace → shared → English chain (`components/app/ListPagination.tsx`). |
| F-02 | Major | Settings deep links were broken three ways: `/settings/:section` silently redirected to `/settings`; the dashboard branding CTA sent `state.section` while `SettingsPage` reads `state.settingsTab`; messaging "configure in Settings" links used `?tab=sms\|whatsapp\|email` — a param nothing read, with section ids that do not exist (`sms`/`whatsapp`/`email`; the panels live under `global`). | One contract: `?tab=<section>` is canonical and validated (`lib/config/settingsDeepLink.ts`), `state.settingsTab` remains supported, tab changes update the URL, `/settings/:section` maps to the query form (`SettingsSectionRedirect`), and both call sites now use the canonical path. |
| F-03 | Major | The command palette declared `role="dialog" aria-modal="true"` but had no focus trap and no focus return; Escape only worked while the search input held focus. | `CommandPaletteModal` now uses `useOverlayBehavior` (focus trap, topmost-only Escape, focus restore) and relies on that trap for initial focus instead of `autoFocus`, which had been capturing focus before the restore target was recorded. |
| F-04 | Major | Form-level save errors were a plain `<div>` — screen readers were never told a save failed. | `FormErrorBanner` is now `role="alert"`/`aria-atomic` and takes focus the first time errors appear (never on later updates, so it cannot steal focus from the field being fixed). |
| F-05 | Major | The collapsed sidebar toggle rendered an icon only: no accessible name, no `aria-expanded`. | Always set `aria-label` (`nav.expand`/`nav.collapse`) and `aria-expanded={!collapsed}` (`tenant/components/layout/Sidebar.tsx`). |
| F-06 | Major | Live push for `finance_fee_structures` had no dispatcher case, and `FINANCE_FEE_STRUCTURES_QUERY_KEY = ["finance","fee-structures"]` was outside `invalidateFinanceQueries`. Admin A editing fee structures left admin B stale (and B's save then overwrote A's). | Both finance keys now route to `invalidateFinanceQueries`, which owns the fee-structure key; the key moved to `financeQueryKeys` (SSOT) and is re-exported by its hook. Regression test asserts the dispatcher invalidates the finance keys. |
| F-07 | Major | A second 401 on the post-refresh retry was returned as data. `isAuthenticationRequired()` ran only on the first response, so `SESSION_EXPIRED_EVENT` never fired and the app stayed "authenticated" behind a permanent error until a hard reload. | The retried response is re-classified; a generic 401 now notifies `refresh_retry_failed` (idle/absolute expiry shapes still self-notify once). |
| F-08 | Major | Platform console pages had no page-level error boundary (tenant pages get one from `AppPageShell`), so any render error replaced the whole console — nav included — with the full-screen root fallback. | Added `PlatformPageBoundary` and wrapped both platform shells' page content; drawers stay outside the boundary. |
| F-20 | Minor | `ROUTES` omitted the live `/workshops` route, and the route-classification test enumerates `ROUTES`, so the guardrail's domain was incomplete. | Added `ROUTES.workshops` plus a registry↔`ROUTES` parity test (mirrors the apex registry test). |
| F-22 | Minor | The `user_not_registered` overlay is host-wide and has no pathname guard, so after a failed login it also replaced `/login`, `/forgot-password` and the public `/apply` admissions forms until sign-out. | Gated through `shouldShowUserNotRegisteredOverlay`: entry paths and `/apply(/:slug)` keep their own page. |
| F-23 | Minor | Cross-tab logout cleared the QueryClient but skipped `clearUserScopedCachesOnLogout`, unlike the logout and session-expiry paths — the previous user's scoped caches survived for the next user on the device. | The storage handler reads the previous user id from `event.oldValue` and clears the scoped caches first. |
| F-24 | Minor | Tenant-facing hardcoded English: `alt="Logo"` on the shell logos, mobile drawer announced as "Open Navigation Menu", command-palette "Recent" header rendered the raw key `nav.recentItems`. | Logos are decorative (`alt=""`, the tenant name is adjacent), the drawer uses `nav.mobileNavigation`, and `nav.recentItems` now exists in all four packs. |

`packages/ui` toast/table labels and the two faculty prose placeholders are
deliberately **not** changed here — they need reviewed translations/`UiConfig`
labels; tracked below.

## 3. Deferred register

Recorded so they are not lost. Each has a concrete next step.

| Item | Evidence | Why deferred | Next step |
| --- | --- | --- | --- |
| ts-rest flattens non-401/403 errors | `lib/api.ts:53–68` throws `ApiError` only for 401/403; 56 hook sites re-wrap `status !== 200` as `new Error`. Result: 404/422/429 are retried 3× with 1-4-8 s backoff, `Retry-After` toast copy never fires, `requestId` is lost for Sentry. | 56 call sites + contract review; changing the transport can change ts-rest hook error semantics. | Throw `ApiError` for `status >= 400` in `tsrApiFetcher` (with `parseRetryAfterSeconds`), migrate hooks domain-by-domain, then delete the re-wraps. |
| Widget toggle writes a stale cached row | `lib/reports/widgetRecordToggle.ts:102–119` resolves the row from the paged list cache (or legacy localStorage) and PUTs the whole record; rows outside the cached page throw "not found". | Needs a field-level endpoint or fetch-by-id; backend contract decision. | Add `PATCH /:id` for the toggled field (audited), then switch the toggle. |
| framer-motion on the entry path | `providers/AppProviders.tsx:9,33` statically imports `MotionConfig`; `vendor-motion` (137 KB raw / 46 KB gz) is in the entry closure and the precache. Only entry-path importer. | Global reduced-motion contract; needs bundle + a11y verification. | Move `<MotionConfig reducedMotion="user">` behind the lazy route tree (keep the a11y gate), then verify `check:bundle`, `check:pwa`, reduced-motion tests. |
| Table memo never hits; synchronous search | `useListRowMotion` returns a new closure per render, `DataTable` rebuilds `tableColumns` and spreads rows into a new array, and `useDataTableState` filters/sorts synchronously per keystroke (48 tables). | Hot shared path; needs before/after render measurement. | `useCallback` the motion factory, `useMemo` columns, pass `state.rows`, add `useDeferredValue(search)` and measure. |
| Coverage denominator excludes 25% of source | `apps/frontend/vitest.config.ts` has no `coverage.include`; `coverage-final.json` instruments 2,104 of 2,820 non-test files (715 invisible, incl. `useTasksApi.ts`, `FinancePage.tsx`, `MessagingPage.tsx`). Floors (55/46/51) are honest only for the loaded subset. | Adding `include` drops measured coverage materially; floors must be re-baselined from a green run. | Add `include`, run full coverage, record the true number, raise floors incrementally. |
| Template server-save failures swallowed | `FinanceTemplateEditor.tsx:68–73` and 5 peers `console.warn` a failed save then toast success. | Local-first/offline template persistence implies a product decision (hard error vs queued sync). | Decide failure UX per editor; `await` + `notify.error`, or explicit "saved locally" copy. |
| Calendar never localizes | `components/ui/calendar.tsx` passes no `locale`/`lang`/`dir`; `react-day-picker` defaults to `enUS`, so ar/ur/fa users see English months and English SR labels. | Needs an Intl formatter/labels design; `date-fns` is not a direct dependency. | Pass `formatters`/`labels`/`lang`/`dir` from `useTranslation` (Intl-based, no new dep) and add RTL weekday tests. |
| Route-change focus/announcement | `#main-content` exists but is never focused and no live region announces SPA navigation. | Needs focus-management design across both consoles. | Focus `#main-content` on pathname change + polite announcement; extend the axe/E2E shell sweep. |
| WS heartbeat + bounded persisted cache + Retry-After | No ping/wake detection on `/api/ws`; the persisted cache is one unbounded blob with 24 h gcTime; `retryDelay` ignores `retryAfterSeconds`. | Needs runtime/soak verification. | App-level ping with pong timeout + reconnect on `visibilitychange`/`online`; cap/exclude paged keys; honour `Retry-After`. |
| 27 orphan files + 26 test-only modules | Import-graph audit, spot-verified (e.g. `LanguagePicker.tsx`, `lib/ws.ts`, `MujtahidManager.tsx` 260 LOC, `lib/performance.ts`); `ObligationsSetupTier` mounts mujtahid management inside `WakalaTypeManager`. | Mechanical deletion batch, no user impact; `ObligationTypeManager` is referenced only by a `vi.mock`. | Delete in a dedicated PR; remove the stale test mock with it. |
| Duplicated setup orchestration & bulk-bar SSOT drift | 11× `use*SetupSaveActions` + 12× `use*SetupPanelState` with identical bodies; `ModuleUniversalBulkActionBar` no longer exists though the rule cites it, with 15 per-module forks. | Large mechanical refactor; F-19 needs a rule/impl decision. | One manifest-driven `useModuleSetupSaveActions` / `useModuleSetupPanelState`; decide whether `BulkSelectionBar` is the sanctioned SSOT and update the rule. |
| Test hygiene | 294 loose assertions (`toBeTruthy`/`toBeDefined`, incl. a vanity contract-hooks test), 237 raw `dispatchEvent` / 753 `querySelector` and no `@testing-library`, 19 leaked React roots, 21 CSS-class assertions. | A programme, not a review fix. | Add an assertion-specificity ratchet with a burn-down baseline, then migrate DOM tests to Testing Library/`userEvent`. |
| Nested module URLs | Tenant router declares exact paths only, so `/examinations/e-1` hits the public shell-less 404 while `routeAccess.test.ts` assumes inheritance. | Routing architecture decision. | Declare splat paths for entries that own subpaths, or make the 404 shell-aware; align the tests. |

## 4. Verified clean

- **Module access**: every registry route is inside `ProtectedRoute` → `ModuleAccessRoute`; unknown paths fail closed; `access.pending`/`error` never render a page; `/settings`, `/profile`, `/notifications` are `open` by design and gate their own sections.
- **Routing**: apex/tenant split via `HostRoutes`; workspace-disabled/missing handling terminates (no redirect loop); `?subdomain=` validated; root `ErrorBoundary` + chunk-load recovery installed before render.
- **API client**: cookie-only auth (`credentials: include`, no token in localStorage), CSRF double-submit refreshed on retry, `AbortSignal.any` + 15 s default timeout, `Retry-After` parsed.
- **Queries**: typed `as const` tuple keys, detail keys nested under list keys so prefix invalidation reaches them, `enabled: isAuthenticated` on app-root queries, IDB persistence keyed per tenant identity and revoked on `clear()`, hydration race handled by `dataUpdatedAt` ordering.
- **Accessibility**: overlay stack (focus trap, topmost Escape, Radix focus guard, ref-counted scroll lock); DatePicker logical spacing and 44 px targets; tables with region/tabIndex/`aria-sort`; reduced-motion clamp, `prefers-contrast`, `forced-colors`; contrast tokens enforced by `designTokens.contrast.test.ts`; axe baseline empty across 15 contexts.
- **i18n**: exact 9,420-key parity after this change (en/ar/ur/fa), locale-aware numeric parameters, `<html dir/lang>` set pre-paint, per-language font stacks.
- **Bundle**: all 20 module pages + auth/setup/apply pages lazy; mermaid/xlsx/jspdf/html2canvas/katex only via `await import`; `vendorChunks` is one SSOT for Rollup and Rolldown; entry closure 29 files (framer-motion is the only avoidable member — see deferred).
- **Code health**: 0 `console.log`/`debugger`, 0 TODO/FIXME/HACK, 0 empty `catch`, 0 `as any`/`@ts-ignore`, all `eslint-disable` lines justified, 0 files over 300 LOC, 0 duplicate component files.

## 5. Verification for this change

```bash
pnpm --filter mms-frontend typecheck
pnpm --filter mms-frontend lint
pnpm --filter mms-frontend test
pnpm run check:i18n && pnpm run check:i18n-unused
pnpm run check:code-norms && pnpm run check:frontend-structure
pnpm run check:work-directory && pnpm run check:shared-ui
pnpm run check:docs
pnpm ci:local
```

New regression tests: `ListPagination.test.tsx`, `CommandPaletteModal.test.tsx`,
`FormErrorBanner.test.tsx`, `Sidebar.test.tsx`, `settingsDeepLink.test.ts`,
`SettingsSectionRedirect.test.tsx`, `invalidateModuleQueries.test.ts`,
`authErrorOverlay.test.ts`, `PlatformPageBoundary.test.tsx`,
`useAuthSessionSync.test.tsx`, plus extensions to `apiClient.test.ts`,
`authContextHelpers.test.ts`, `routes.test.ts` and
`MessagingGatewayStatusOverview.test.tsx`.

**TDD evidence (each spec failed before its fix):** `invalidateModuleQueries` 2/3
failed (fee-structure key not invalidated), `apiClient` 1/13 failed (no
`refresh_retry_failed` event), `settingsDeepLink`/`SettingsSectionRedirect`
failed on missing modules, `ListPagination` 2/2 failed (raw keys),
`CommandPaletteModal` 3/3 failed (no trap, no Escape from a row, no focus return),
`FormErrorBanner` 1/3 failed (no alert, no focus), `Sidebar` 2/2 failed (no
accessible name/state), `PlatformPageBoundary` failed on its missing export,
`useAuthSessionSync` 1/1 failed (scoped caches survived), `routes` 2/18 failed
(`/workshops` missing), `MessagingGatewayStatusOverview` 1/1 failed (invalid tab).

Final run after the fixes: **1,034 files · 3,715 passed / 2 skipped** (was 1,024 /
3,684), `check:i18n` 9,420 keys ×4 locales with 0 missing, and every ratchet above
green.

## 6. Doc reconciliation

- [frontend-review-2026-10-30.md](./frontend-review-2026-10-30.md) — F-FE-1…5 still
  implemented (precache closure transform, chunk recovery, pre-paint `dir`, provider
  fallbacks, dead-asset removal). Re-measured entry closure: 29 JS files / 1,829 KB
  raw, with framer-motion the only avoidable member (the earlier 30 files / 1,838 KB
  figure has drifted).
- [frontend-performance-baseline.md](./frontend-performance-baseline.md) — provider
  memoization, `RouterBridge` cancel removal, compiler opt-in and directory-view
  deferral are still accurate; compiler remains default-off.
- [open-items.md](./open-items.md) §9 previously claimed finance fee structures are
  "not broadcast"; that was stale — the backend has broadcast
  `finance_fee_structures` since `financeBillingUseCases`. Corrected, and the
  dispatcher gap is fixed here.
