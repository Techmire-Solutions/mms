# Frontend Performance Baseline

Scope: `apps/frontend` (React 19 + Vite 8, TanStack Query v5). Records the render-hygiene and React
Compiler changes from the frontend performance pass, the measurements that back them, and how to
re-measure. Companion to [a11y-baseline.md](./a11y-baseline.md) (executable gates); this file is the
performance reference.

## Applied changes

**Render cascades (P0)**
- `src/lib/contexts/TranslationContext.tsx` — `t` memoized (`useCallback([activeLanguage])`) and the
  provider value `useMemo`'d. Previously an inline literal + per-render `t`, so every top-level
  navigation/settings event re-rendered all ~1,090 `useTranslation` consumers.
- `src/lib/contexts/TenantContext.tsx` — `refetchWorkspace`/`redirectToApex`/`redirectToTenant` are
  `useCallback`'d and the value `useMemo`'d (this provider feeds `TranslationProvider`).
- `src/providers/DirectionProvider.tsx` — value `useMemo`'d (was a per-render IIFE literal).
- `src/components/routing/RouterBridge.tsx` — removed a blanket `queryClient.cancelQueries()` that ran
  on every top-level nav change and aborted unrelated in-flight requests. Unmount + `gcTime` suffices.

**React Compiler (P1) — opt-in, default off**
- `vite.config.ts` passes `react({ compiler: process.env.MMS_REACT_COMPILER === "1" })`
  (`@vitejs/plugin-react` v6 `compiler` option, powered by `oxc-transform-react`; **not** the Babel
  plugin). `turbo.json` declares `MMS_REACT_COMPILER` in the `build` task `env` so it survives turbo's
  strict env mode. Enable per build with `MMS_REACT_COMPILER=1`.

**Others**
- `src/lib/useUiStateStore.ts` — per-key debounce (a `Map` of timers) + rollback to the last
  server-confirmed value on PATCH failure; `initialize` resets timers/snapshot.
- `src/components/app/CommandPalette.tsx` — prefetch the highlighted destination's chunk.

**Lint guardrails (P3)**
- `mms-react/no-unmemoized-context-value` (`eslint-rules/no-unmemoized-context-value.cjs`) — bans
  `<X.Provider value={{…}}>` inline object literals; landed as `error` after memoizing the 5 existing
  sites (`RadioGroup`, `ui/form.tsx` ×2, `ui/table.tsx`, `SettingsPage`). Test fixtures are exempt.
- `jsx-a11y/*` and the React Compiler rules stay at `warn` (see below).

## Measured results

### React Compiler bundle delta
| Build | Sum of `dist/assets/*.js` (raw) |
| ----- | ------------------------------- |
| compiler OFF (default) | 14,633,762 B (~14.6 MB) |
| compiler ON (`MMS_REACT_COMPILER=1`) | 16,511,732 B (~16.5 MB) |

**+1,877,970 B (~+1.88 MB, +12.8%) raw.** Expected memo-cache overhead (`useMemoCache` call sites —
the build logged 3,075 `vite:react-compiler` transforms). Because the compiler is opt-in, production
defaults are unaffected; weigh this against the `check:bundle` budget before flipping the default.

Method: `pnpm --filter mms-frontend build` with and without `MMS_REACT_COMPILER=1`, then
`find apps/frontend/dist/assets -name '*.js' -exec cat {} + | wc -c`.

### Lint findings (2026-10-29: 0 errors, 150 warnings; `pnpm lint --quiet` green)
- `mms-react/no-unmemoized-context-value`: **0** after the 5 fixes — rule is `error`.
- `react-hooks/set-state-in-effect`: **0** (was 128) — burned down by moving state
  derivation/resets to render, lazy initialisers, and event handlers. One documented
  disable remains in `useIdleTimer` (its deadline lives in refs and must be re-synced
  synchronously). The rule is now **`error`**, so a new scripted `setState` in an
  effect fails `pnpm lint`.
- `jsx-a11y/*`: **68** findings (`no-autofocus` 19, `no-static-element-interactions` 18,
  `click-events-have-key-events` 14, `no-noninteractive-element-interactions` 7,
  `no-noninteractive-tabindex` 6, `interactive-supports-focus` 3, one role rule). Triaged
  in ADR-017 as mostly correct interaction patterns; the semantics-only rules are `error`.
- Remaining `react-hooks/*` compiler rules (**82** findings, all `warn`): `refs` 45,
  `incompatible-library` 13, `immutability` 11, `purity` 4,
  `preserve-manual-memoization` 4, `use-memo` 3, `static-components` 2. Triage these
  before flipping the compiler default; do not re-enable `set-state-in-effect` exceptions.
- Total warnings fell 256 → 150 in this pass.

> **Cache caveat:** `eslint --cache` can hide warnings seeded by an earlier `--quiet` run — an initial
> `lint:warn` reported 0 jsx-a11y findings that a `--no-cache` run revealed as 146. Always measure with
> `--no-cache`.

## Service-worker precache (2026-10-30)

The PWA service worker used `globPatterns: ["**\/*.{js,css,html,ico,png,svg,woff2}"]`, so it
precached **every** emitted chunk on install — including optional vendors that route-level lazy
loading exists to defer, all four locale packs, and an unused 1.2 MB logo.

| Measure | Before | After |
| --- | --- | --- |
| Precache entries | 647 | 38 |
| Precached payload (raw) | 16.3 MB | 2.29 MB |
| Compressed-equivalent | ~5.0 MB | ~0.5 MB |
| `dist/sw.js` | 40 KB | 4.2 KB |

After: `globPatterns` covers the shell only (`index.html`, manifest, icons), and a Workbox
`manifestTransforms` hook (`apps/frontend/src/lib/pwa/entryClosurePrecache.ts`) adds the **static
import closure** of the entry (30 files / 1.84 MB raw / 431 KB br) read from
`dist/.vite/manifest.json`. Route chunks, mermaid/elk, xlsx, jspdf, katex and the non-default locale
packs stay lazy and are captured by the `/assets/` `CacheFirst` runtime rule once visited.

Measured with `pnpm --filter mms-frontend build && pnpm run check:pwa` (budget: ≤ 50 entries /
≤ 3.5 MB raw, and no `elk`/`cytoscape`/`xlsx`/`jspdf`/`html2canvas`/`katex`/`i18n-{ar,ur,fa}`/
`platform-logo` entry). Initial JS payload is unchanged: 30 files / 1,838 KB raw / 431 KB br.

## Entry chunk and table render hot path (2026-10-30, tranche 2)

**framer-motion leaves the entry closure.** `MotionConfig` used to be mounted in
`src/providers/AppProviders.tsx`, which is eagerly imported by `main.tsx`, so the whole
runtime sat on the first paint and in the precache — even though every `motion.*` renderer
lives under the authenticated tenant shell or the apex tree. It now lives in
`src/providers/MotionPreferences.tsx`, mounted by `tenant/components/layout/AppLayout.tsx`
and `platform/routes/ApexRoutes.tsx` (`ApexRoutesWithSuspense`); unauthenticated entry pages
(login, forgot, 2FA, admissions, institution setup) never load it.

| Measure | Before | After |
| --- | --- | --- |
| Entry closure (static imports of `index.html`) | 29 JS files / 1,829 KB raw | 28 / 1,693 KB raw |
| `vendor-motion` in the entry closure | yes — 137 KB raw / 46 KB gzip | no (still emitted for the shells) |
| PWA precache | 38 entries / 2.29 MB raw | 37 / 2.16 MB raw |
| Total emitted JS | 14.66 MB raw / 4.18 MB gzip | 14.66 MB raw / 4.18 MB gzip |

Method: `pnpm --filter mms-frontend build`, then walk `dist/.vite/manifest.json` from the
entry's static `imports`; `node scripts/check-pwa-precache.mjs`;
`node scripts/check-bundle-budget.mjs`. `check:pwa` now also fails if
`vendor-motion-*.js` reappears in the precache.

**Table rows stop re-rendering on unrelated updates.** `useListRowMotion` returned a new
closure per render, `useModuleColumnLayout` rebuilt its column registry, and `DataTable`
rebuilt its column array and spread `state.rows`, so the `React.memo` row never hit.
All four identities are stable now, and search filtering runs through `useDeferredValue`.
`components/common/data-table/DataTable.memoization.test.tsx` asserts: three rows render
three cells once; an unrelated parent re-render causes **0** further cell renders; adding a
row renders exactly the new one; typing a search still narrows the table.

## How to measure (render cost — manual)

React Profiler needs a running app, so no render counts are recorded here. To capture them:

1. Start the stack with `./restart_servers.sh` (see the `mms-dev-setup` skill).
2. React DevTools → Profiler → record, then:
   - navigate between two top-level modules (exercises `TranslationProvider` / `RouterBridge`);
   - switch language (exercises `TranslationContext`);
   - toggle a settings preview (`SETTINGS_PREVIEW_EVENT`, exercises the `useGlobalSettings` fan-out).
3. Compare committed duration and render counts against a pre-change build.

## Verification

`pnpm --filter mms-frontend typecheck` · `pnpm --filter mms-frontend lint` · `pnpm test` ·
`pnpm build` + `pnpm run check:bundle` (with the compiler flag on and off) + `pnpm run check:pwa`.
