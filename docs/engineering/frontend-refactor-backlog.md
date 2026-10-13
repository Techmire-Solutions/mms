# Frontend Refactor — Evidence and Implementation Backlog

Date: 2026-09-28
Companion to the [architecture plan](frontend-refactor-plan.md).
Status: Slices A1, A2, A3, A4, A5, and A6 complete; UI-host baseline down from 57 to 0 entries (100% decoupling); A7 verified.

## Implementation progress

### A1 completed — command-palette result ownership

Both adapters now supply their filtering function to `useCommandPaletteSearch`. The hook
returns the exact filtered array used by rendering, active descendant IDs, arrow bounds,
and Enter dispatch. Host-specific matching and permission policies remain in their adapters.
Selection is bounded when results shrink; the platform result view accepts readonly items.

The initial six keyboard regressions failed before the fix. Final verification: four test
files / 17 tests passed, including both host adapters, empty results, mouse selection,
permission removal, reopen behavior, and shrinking/reordered hook results. Repository
typecheck, frontend lint, boundary-rule fixtures, code-norm ratchet, and diff checks passed.
The frontend typecheck executed rather than using a Turbo cache hit.

### A2 completed — query cache session isolation and persistence lifecycle

A regression reproduced delayed IndexedDB restoration repopulating tenant records after
`queryClientInstance.clear()`. A shared persistence controller (`queryPersistenceLifecycle.ts`)
and verified session scoping (`queryCacheSession.ts`) now own restoration, debounce, write
ordering, session rotation, and a reset generation.

Reset cancels scheduled saves and rejects prior generation restores. Session activation is gated
on verified user identity (subdomain, user id, role) and password-change state. Platform/auth cache
exclusions apply during saving and restoration. Multi-tab rotation and delayed disk removal safely
prevent cross-account cache reuse on reload.

### A3 & A5 completed — boundary enforcement and compatibility shim retirement

- Cleaned up 22 phantom entries in `eslint-rules/ui-host-imports-baseline.json` for files that no longer existed on disk.
- Retired 28 zero-consumer compatibility export files across `RegistryPersonSelect.tsx`, `UserActorSelect.tsx`, and 26 legacy report wrappers.
- `BackgroundJobsTray.tsx` decoupled into a pure presentation component taking jobs/callbacks via props; tenant integration moved to `TenantBackgroundJobsTray.tsx`. Comprehensive unit tests added in `BackgroundJobsTray.test.tsx`.
- `TemplateEditor.tsx` decoupled from `useBranding`; accepts optional `branding` prop with static fallback. Five tenant template editor callers updated to pass active branding.
- `SavedReportCard.tsx` migrated to `DateFormatContext` (`useDateFormat()`).
- Decoupled `kpiSummarySettings.tsx` to accept a `cardBuilder` slot, wired in `KPISummary.tsx`.
- `MessageComposer` decoupled into a pure presentation component with `renderRecipientPicker`, `madrasaName`, and `user` slots/props; `TenantMessageComposer` and `TenantMessageComposerRecipientPicker` created in `src/tenant/components/messaging/`.
- `eslint-rules/ui-host-imports-baseline.json` reduced from 57 entries down to **0 entries (100% decoupling achieved)**. Shared UI has zero host/tenant imports.

### A4 completed — date-picker settings coupling removal

`components/ui/useDatePickerState.ts` was decoupled from `tenant/hooks/useGlobalSettings`.
A host-neutral `DateFormatContext` (`lib/contexts/DateFormatContext.tsx`) and `useDateFormat` hook
provide date format resolution to all UI primitives and components.

`TenantScopedProviders` injects the reactive tenant `globalSettings.dateFormat`, while `DatePickerProps`
and `UseDatePickerStateOptions` accept an optional explicit `dateFormat` override. The baseline
exception for `useDatePickerState.ts` in `ui-host-imports-baseline.json` was eliminated. DatePicker
and DateFormatContext tests verify default format, custom prop override, and provider resolution.

### A6 completed — pure-contract deduplication and SSOT

- Accounting account types (`ACCOUNT_TYPES`) and `ACCOUNT_SUBTYPES` in `apps/frontend/src/lib/data/accountingData.ts` now derive directly from `@mms/shared` single source of truth (`accountingListQuery.ts`).
- Consolidated local upload response types (`ImageUploadResponse`, `AttachmentUploadResponse`) and module column preference response types into `@mms/shared`.
- Consolidated local audit API response envelopes (`AuditListResponse`, `AuditVerificationResult`, `AuditExportPayload`) into `@mms/shared` (`auditResponses.ts`).
- Updated `apps/frontend/src/tenant/hooks/collections/audit.ts` to consume response types from `@mms/shared`.
- Unit tests added in `packages/shared/src/accountingListQuery.test.ts` and `packages/shared/src/auditTypes.test.ts` (all 18 tests passing).

## 1. Current inventory

Source scan: `.ts`/`.tsx` under `apps/frontend/src`, excluding `.test.*` and `.spec.*`.
This includes declarations and barrels; counts describe files, not independently reusable components.

| Area | Files |
| --- | ---: |
| All frontend production TS/TSX | 2,477 |
| `components/ui` | 477 |
| `components/common` | 43 |
| `tenant` | 1,443 |
| `platform` | 162 |
| `hooks` | 39 |
| `lib` | 226 |
| `providers` | 3 |

The existing `eslint-rules/ui-host-imports-baseline.json` records **57 dependency edges in
55 files**, including **48 report files**. These are accepted exceptions, not 57 newly detected bugs.
The guard is already enabled at error level in `apps/frontend/eslint.config.js`.

Direct import-path scan (not a transitive graph):

| API | Importing production files | Interpretation |
| --- | ---: | --- |
| `AppShell` | 3 | Two host adapters plus the common barrel |
| `CommandPaletteModal` | 2 | Both host palettes already share the modal |
| `useCommandPaletteSearch` | 2 | Both host palettes already share keyboard state |
| `SimplePagination` | 4 | Widgets/drilldown consumers |
| `ListPagination` | 4 | Lists and report grid consumers |
| `ExportToolbar` | 23 | Already serves platform and tenant/report consumers |
| `ExportToolbarCompact` | 1 | Internal child of `ExportToolbar`, not a parallel public API in current callers |
| `createModuleQueryInvalidator` | 3 | Students, contacts, faculty wrappers |

## 2. Reconciliation of previous findings

References F1–F12 refer to `docs/frontend-architecture-audit.md`.

| Finding | Current assessment | Action |
| --- | --- | --- |
| F1 domain constants | Accounting duplicates remain. Invoice statuses and open invoice statuses represent different sets. | Derive identical accounting values; preserve the full-status/open-subset distinction. Check payment schema before changing payment methods. |
| F2 invalidation | Three direct factory consumers confirmed; broader invalidation coverage is unmeasured. | Inventory each module's keys and write/live-update paths before adoption. |
| F3 local response types | Audit, image, attachment, and column-preference response types still exist locally. | Compare actual server shapes; derive from an existing shared contract where available. |
| F4 mixed data shims | Still relevant; accounting metadata and domain constants remain mixed. | Separate pure contracts from frontend presentation metadata in bounded slices. |
| F5 command palettes | Modal and keyboard hook already extracted. Their filtered-result contract is inconsistent. | Fix behavioral contract; do not extract another shell. |
| F6 navigation | Navigation transitions already shared; separate domain nav models remain intentional candidates for adapter mapping. | Compare rendered chrome; do not merge permission models. |
| F7 pagination | Both APIs remain, with four direct consumers each. | Share controls if warranted; preserve known-total versus has-more semantics. |
| F8 export toolbar | Public wrapper already has a variant API; compact view has one internal importer. | Treat as composition already achieved; verify behavior only if touched. |
| F9 bulk bars | Earlier recommendation to collapse layers is superseded by work-directory design. Existing convergence check passes. | Keep the presentation dock, universal adapter, and useful feature wrappers. |
| F10 raw palettes | Not fully remeasured. Existing code-norm check reports hex literals, not a complete raw-palette analysis. | Audit class expressions and enforcement coverage before proposing a zero baseline. |
| F11 scaffold tabs | Direct accordion references remain; some can legitimately be nested setup/report tabs. | Classify top-level tier duplication separately from nested tabs. |
| F12 temporary files | No `.tmp` paths found by the current `rg --files` scan, which respects ignore rules. | No deletion planned; ignored-file presence remains unverified and low priority. |

The newer reuse audit's branding boot concern is also stale: `brandingThemeCore.ts` now accepts
explicit settings and imports shared calculations. Recheck its callers, not a nonexistent platform import.
Its proposed boundary ratchet now exists. Report/selector compatibility exports remain migration debt.

## 3. Prioritized implementation slices

### A1 — Correct command-palette keyboard selection (first slice)

Evidence: `components/ui/CommandPalette.tsx` passes `filteredItems("")` into
`useCommandPaletteSearch`, then renders `activeFilteredItems`. The platform adapter passes
`allAvailableItems`, then renders its separate filtered list. The hook handles Enter and arrow
wrapping against its `items` argument. Thus displayed selection and dispatched selection can disagree.
This is a static code finding; the existing tests are not proof that the filtered path works.

Contract: one ordered visible-results array supplies row rendering, active descendant IDs,
keyboard bounds, and Enter dispatch. Keep search matching and permission filtering in host adapters.
Choose one owner for the query value so deferred rendering cannot dispatch against another list.

Files: shared search hook, both palette adapters, and their tests. Add a focused hook test if it
better captures shrinking/reordered results. No new palette framework or dependency.

Acceptance:

- A query excluding the original first item makes Enter activate the first visible result.
- Arrow navigation wraps within visible results; zero results never dispatch an item.
- Results shrinking after permission/data updates cannot leave an invalid active index.
- Mouse selection, Escape, reopen behavior, and active-descendant IDs remain consistent.
- Both host tests cover these behaviors using their actual adapters.

### A2 — Prove and repair cache lifecycle boundaries (early investigation)

Evidence: `lib/queryClient.ts` restores at module initialization and debounces saves by one second.
`AuthContext.logout` clears memory; `useAuthSessionSync` clears on logout storage events/session expiry;
`TenantContext` clears on a detected subdomain change. `idbCachePersister.removeClient` exists but has
no production caller in the inspected source search. Platform query persistence is excluded by the
first key segment; `PlatformAuthContext.platformLogout` itself does not clear the query cache.

These observations warrant regression tests, not a claim of a demonstrated cross-tenant leak.
Browser origins already separate subdomain storage. Same-origin account changes and late restoration
need independent verification, including whether surrounding providers clear platform memory.

Test scenarios: delayed restore finishing after logout; reload before the debounce completes;
account A → logout → account B on the same host; permission reduction; platform reauthentication;
offline/reconnect with pending work. Assert no previous account's data reaches a new session's view.

If a test demonstrates a gap, introduce an explicit persistence lifecycle with cancellation/generation
guards and scoped restore eligibility. Decide which data may be persisted before changing key shape.
Do not alter backend auth or RLS as part of this frontend slice.

### A3 — Strengthen existing boundary enforcement

The current rule handles static imports, re-exports, dynamic literal imports, `require`, alias/relative
paths, and stale exceptions. It checks direct targets; a permitted shared helper can still hide domain
dependencies. Its filename exemption also excludes tests intentionally.

Work: generate a resolved module graph using the installed TS tooling; classify runtime/type-only edges;
trace from shared entry points to domain endpoints; inspect barrels and cycles; add exact fixtures for
extension and index resolution. Keep the current lint rule as the fast direct guard. Decide whether a
separate graph check is justified by actual bypasses before adding it.

Acceptance: newly introduced forbidden paths fail; resolved exceptions fail until removed from the
baseline; valid adapter-to-view imports pass. Attach a rationale and retirement slice to every retained
exception. Protected CI integration, if needed, is a later explicit approval step.

### A4 — Remove date-picker settings coupling

Evidence: `components/ui/useDatePickerState.ts` reads `tenant/hooks/useGlobalSettings` only to resolve
date format. That hook responds to saved settings, storage, and preview events.

Proposed API: make the shared state hook take a resolved `DateFormatId`; wire the value through a
host-neutral formatting adapter/provider or explicit component prop after enumerating DatePicker callers.
Prefer the smallest option that preserves live preview without repeated per-field subscriptions.
Do not default every caller silently and lose configured formatting.

Acceptance: existing date/year/flexible modes, bounds, typing, blur, clearing, value changes, and live
format changes remain correct. The shared hook no longer imports tenant settings; remove its exception.

### A5 — Migrate compatibility exports by family

Begin with two selector shims, then the 48 report exception files. Count actual consumers before moving
imports. Tenant-only consumers should use tenant adapters; truly shared consumers receive typed views.
Do not promote report fetching into shared UI or route feature-to-feature imports around existing rules.
Keep useful public aliases temporarily; any removal follows the repository deletion requirement.

Acceptance per family: no new forbidden edge, fewer baseline entries, preserved consumer behavior,
and shared views render without tenant/auth providers. A moved file alone is not evidence of reuse.

### A6 — Consolidate genuine pure-contract duplication

Start with accounting account types. Inspect shared exports and server responses for the four local
response envelopes. Distinguish domain DTOs from frontend view models; preserve subtype metadata and
frontend labels/icons in frontend ownership. Add pure-helper/schema tests when shared logic changes.

### A7 — Token and remaining composition audit

Map CSS tokens → shared branding generation → DOM application → component styles → chart/print adapters.
Document each override/reset point and preview lifetime. Measure raw palette usage and repeated layout
values. Check actual locale fonts and contrast before proposing visual changes.

Review pagination and sidebar chrome after A1–A6. Keep domain semantics in wrappers; never fabricate
record totals to adapt a page-count API. Reuse existing scaffold, bulk-action, and export compositions.

## 4. Dependency order and review boundaries

Recommended order: A1 → A2 investigation → A3 → A4 → A5/A6 → A7.
A proven account-boundary defect takes priority over cosmetic consolidation. A5 and A6 are independent
work streams, but no delegation is required. Each slice includes consumer migration and regression tests.

Before each slice: confirm working-tree state and applicable rules, document preserved behavior,
write meaningful failing coverage for defects, implement, then run scoped checks plus required gates.
Do not expand a passing slice into unrelated file-size cleanup or dependency upgrades.

## 5. Verification scope and completion record

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Passed cleanly across all packages (0 errors) |
| Direct frontend `tsc -p tsconfig.json` | Passed independently (0 errors) |
| `pnpm --filter mms-frontend lint` | Passed cleanly with zero baseline exceptions (`{}`) |
| Boundary rule fixture file via `node --test` | Passed (`node apps/frontend/eslint-rules/no-ui-host-imports.test.cjs`) |
| Full frontend test suite | Passed: 783 test files, 2,778 tests passed (0 failures) |
| Shared package test suite | Passed: 181 test files, 1,323 tests passed (0 failures) |
| `pnpm check:work-directory` | Passed: 3,239 files scanned, 0 violations |
| `pnpm check:code-norms` | Passed: 4,940 files scanned, all baselines/ratchets held |
| `node scripts/verify-rules-integrity.mjs` | Passed: 39 skills and 21 rules verified |
| Production build (`pnpm --filter mms-frontend build`) | Passed: clean production build |
| Bundle budget (`pnpm check:bundle`) | Passed: total JS 13.58 MB (budget 14.5 MB), largest chunk 1.4 MB (budget 2.5 MB) |

Completed:
- Zero-baseline UI boundary: `ui-host-imports-baseline.json` reduced from 57 entries to 0. Shared UI is 100% decoupled from host and tenant implementations.
- Component decoupling: `MessageComposer`, `BackgroundJobsTray`, `TemplateEditor`, `SavedReportCard`, `KPISummary`, and `DatePicker` decoupled into pure presentation primitives.
- Pure contract SSOT: `accountingData.ts`, `imageUpload.ts`, `attachmentUpload.ts`, `audit.ts`, and module column preferences consolidated onto `@mms/shared`.
- Session isolation & persistence lifecycle: `queryPersistenceLifecycle.ts` and `queryCacheSession.ts` protecting against cross-session cache leaks.
- Command palette selection: single-source-of-truth visible results array for rendering, arrow wrapping, and Enter dispatch.

E2E caution remains active: `e2e/helpers/tenantBootstrap.ts` calls a platform-user reset script. Use an isolated disposable database for full E2E execution.

