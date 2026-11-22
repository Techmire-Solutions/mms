# MMS Hooks Review Report

Repo-wide React hook audit — every hook reviewed one-by-one, bugs fixed with regression tests, and each hook modernized to the project's best-practice bar (React 19.3.1, TanStack Query v5, RHF 7.92, compiler-readiness). Checklist SSOT: [.agent/skills/mms-frontend/references/hook-review-checklist.md](../.agent/skills/mms-frontend/references/hook-review-checklist.md).

## Scope & coverage

| Layer | Files reviewed | Verdicts |
|---|---|---|
| `src/hooks` | 76 | fixed/OK — `useIdleTimer` restructured (React 19 `useEffectEvent`), `useMediaQuery` → `useSyncExternalStore`, B0 fix in `useLiveCollection` (server rows never rendered) |
| `src/lib` (27 + contexts) | ~40 | fixed/OK — B0: `AuthContext` unstable ops (disable hid identity churn), CSV import out-of-order file reads; `useDocumentTemplates` cache rework |
| `src/components` (60 hooks) | 62 | fixed/OK — 7 disable sites eliminated, 14 files fixed, refs 15→0 |
| `src/platform/hooks` (40) | 40 | fixed/OK — B0: 4xx resolved as success in 6 platform mutations (`usePlatformAuthActions`, `usePlatformAdmins`, `usePlatformAdminLifecycle`, `usePlatformProfile`, `usePlatformSettings`); session-timeout idle race; notification-ack cross-admin leak |
| `src/tenant/hooks` (44) | 44 | fixed/OK — B0: audit query key IDB-persistable, ui-state 401 storm, read-receipt double-POST, `useHydrateGlobalSettings` StrictMode double-hydration race |
| `src/tenant/features/*/hooks` (518, 20 features) | 518 | per-feature verdicts below |

## Feature-layer B0 bugs found & fixed (all with Red→Green regression tests)

- **attendance** — fresh roster reported `isDirty=true` (false unsaved-changes blocks); Space always marked 'absent' (status cycle bug); infinite render loop in server-row merge.
- **messaging** — dated KPI metrics silently dropped `endDate` and sent a bogus param (unfiltered metrics); shift-click range anchor resurrected across pages; unhandled clipboard rejection; stale unknown-token error.
- **users** — `useUsersByIds` truncated results beyond 100 ids.
- **obligations** — settings PUT fired twice per update; lookups ran unauthenticated.
- **faculty** — designation rows stale on `profileStatus` change (hidden by a deps disable).
- **question-bank** — stale-page request on every filter change; duplicate-check never aborted.
- **sessions** — `enabled` flag inside the cache key partitioned the cache (refetch on every tab toggle); lookups/prefs fetches ignored AbortSignal.
- **accounting** — session voucher id re-minted via ref mutation during render.
- **enrollments** — optimistic detail row and server payload carried different timestamps.
- **students** — GR migration had no single-flight coordination (duplicate backfill loops).
- **reports** — garbage localStorage writes for empty switch-state keys.
- **contacts / finance / hasanat / examinations / settings / dashboard / tasks / workshops / profile / notifications** — no B0 defects; B1/B2 modernization applied (see git log of each feature dir).

## Compiler-lint & ratchet burn-down (repo-wide, no-cache eslint)

| Metric | Before | After |
|---|---|---|
| `react-hooks/refs` | 66 | **1** (justified: `useDynamicChartVisualizer` export handler accessor — ref read only in event handlers) |
| `react-hooks/incompatible-library` | 14 | **0** (RHF `watch()`→`useWatch`; TanStack Virtual sites carry documented per-site exceptions) |
| `react-hooks/immutability` | 11 | **0** |
| `react-hooks/preserve-manual-memoization` | 8 | **0** |
| `react-hooks/purity` | 5 | **0** (`Date.now()` in render → stamped at user events) |
| `react-hooks/use-memo` | 3 | **0** |
| `react-hooks/static-components` | 1 | **0** |
| `react-hooks/set-state-in-effect` (error) | 0 | **0** |
| `exhaustive-deps` disables | 29 | **2** (test files only, compiler-exempt) |
| 300-line ceiling regressions | 0 | **0** (two files trimmed back) |

## Cross-cutting SSOT (P5)

- Background-jobs mirror now tenant+user scoped ([backgroundJobStorageKeys.ts](../apps/frontend/src/lib/backgroundJobs/backgroundJobStorageKeys.ts)) with provider injection from both auth contexts + logout purge; `fetchBackgroundJobs` gained AbortSignal.
- Stored-notifications query key auth-prefixed (IDB persistence fix).
- Platform query keys registered in SSOT (`platformQueryKeys.ts`); ERD query auth-gated; platform notification-ack storage extracted to a cycle-free lib module with logout purge.
- Template fetch + all four integration-config fetchers now accept AbortSignal; shared integration panels abort on unmount/reload.
- Documented exceptions: 5× TanStack Virtual `incompatible-library` sites (upstream compiler incompatibility), 1× `refs` (event-only accessor), 2× `useLayoutEffect` (pre-paint positioning).

## Verification (all green)

- `pnpm typecheck` (full monorepo, clean cache) ✅
- Full frontend suite: **1373 files / 5184 tests passed** (baseline 5015 → +169 regression tests) ✅
- Backend suites unchanged by this task (4,329 unit + 799 db-integration green from prior audit) ✅
- ESLint no-cache: 0 errors; warn inventory per table ✅
- `MMS_REACT_COMPILER=1` production build ✅ (compiler transforms 3,706 modules)
- Prettier clean on all changed files ✅
- `check:shared-ui` · `check:code-norms` (300-line ratchet) · `check:frontend-structure` · `check:i18n` · `verify-rules-integrity` ✅
- Playwright smoke: 55/55 ✅

## Deferred follow-ups — resolved in the continuation round

- Attendance lookups/preferences now forward `AbortSignal` via `fetchOptions` (no `@mms/shared` contract change was needed — ts-rest client args accept `fetchOptions.signal`); pinned by existing tests.
- `usePersistedTabState` returns a referentially stable setter (memoized on the store setter) and exports a stable `identityTabNormalizer`; `SettingsPage` consumes it, removing the per-render setter churn behind hotkey/effect registrations.
- TDD-pairing gap closed: `platform/use-cases/consolidationUseCases.ts` now has [consolidationUseCases.test.ts](../apps/backend/src/__tests__/consolidationUseCases.test.ts) pinning the `HttpDomainError` contracts (500/404/422 + types + messages).
- Loose-assertion ratchet restored: six new loose assertions tightened (baseline unchanged, still 277).
- 300-line ceiling restored (`useMessageComposerDispatch.ts` 299, `useTasksApi.ts` 298).
- Faculty SSR workaround mocks removed — the 4 pre-existing SSR specs pass unmocked again, proving the `getServerSnapshot` fix end-to-end (the new regression spec keeps its fixed-date mock for determinism).
- `docs/forms-inventory.md` regenerated after form edits; report indexed in `docs/README.md`.
- **`pnpm ci:local` fully green** and **`pnpm ci:local:full` Phase A (all automated completion-review checks) green** (prettier, frontend vitest 1373 files / 5184 tests, shared tests, backend vitest 619 files / 4333 tests, typecheck, lint, all ratchets).

## Adversarial 4-vector audit (mms-completion-review §4)

**Edge cases** — OTP normalization/attempt-ceiling/re-arm verified in `otpChallengeService` (220 lines, adapter-parameterized; the 4 flow suites pass unmodified). SSR `getServerSnapshot` verified by faculty SSR specs running unmocked. `keepPreviousData` swaps are pure-idiom replacements. Empty `to` on SMS dispatch: sanitize preserves prior behavior (pre-existing, unchanged). No new edge-case defects.

**Failure modes** — reply-once verified in both middlewares (`reply.sent` guard + helper early-returns; no double-send). `smtpTransport` null-guards map to `not_configured`; integration-panel fetch aborts prevent unmounted writes. `consolidationUseCases` errors carry byte-identical status/type/message (pinned by the new spec). Note (pre-existing, not a regression): integration fetch helpers swallow all errors, so network failures silently return `null`.

**Security / multi-tenancy** — background-jobs mirror scoped `workspace + _u:<user>` with logout purge in both consoles; platform notification-ack keys purged on logout; `STORED_NOTIFICATIONS_QUERY_KEY` auth-prefixed (IDB-restore fix); ERD query now auth-gated. No tenant-boundary leaks introduced.

**Concurrency** — `useGrMigration` single-flight module promise (joiners share, reset in finally); hydration in-flight map cleaned on settle; CSV import monotonic selection token; panel loads abort prior in-flight reads. OTP concurrent-verify races keep the pre-consolidation load-then-update pattern (no regression; one-shot flows use atomic claim).

Verdict: **no blocking findings**; two pre-existing non-regressions noted (silent fetch-error swallowing, OTP verify race) as candidates for future hardening.

## Post-audit hardening (follow-up commits)

- **Work search debounce moved to the shared leaf** — `ModuleWorkToolbar` now owns the 250 ms leaf debounce with the last-pushed guard (external resets adopt immediately, never echo back), so every module's page controller/metrics/directory stops re-rendering per keystroke; `ContactsListFilters` dropped its duplicate debounce. New toolbar contract tests + `DataTable` spec updated to advance the debounce clock.
- **Finance query-key collision ended** — the tsrClient envelope key renamed `FINANCE_CONTRACT_PREFERENCES_QUERY_KEY` (the same identifier previously resolved to two different arrays via different import paths).
- **Create-hotkey churn closed** — question-bank's `openAddQuestion`/`openCreatePaper` are `useCallback`-stable, so the `Cmd+N` listener registers once.
- **All `exhaustive-deps` disables eliminated repo-wide** (29 → 0): the last two were mount-once test doubles, restructured to latest-callback refs with complete deps.

## Remaining deferred (documented, non-blocking)

- `useDynamicChartVisualizer` keeps the single justified `react-hooks/refs` exception (event-only accessor; restructure would need a cross-layer handler redesign).
