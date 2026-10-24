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

### Lint findings (all `warn`; `pnpm lint --quiet` stays green)
- `mms-react/no-unmemoized-context-value`: **0** after the 5 fixes (was 5) — rule is `error`.
- `jsx-a11y/*`: **146** findings (no-autofocus, click-events-have-key-events, no-redundant-roles,
  control-has-associated-label, no-static-element-interactions, …).
- `react-hooks/*` compiler rules (enabled from `recommended-latest` as `warn`): **359** findings —
  `set-state-in-effect` 128, `refs` 43, `immutability` 13, `incompatible-library` 9, `globals` 8,
  `purity` 4, `preserve-manual-memoization` 4, `use-memo` 2, `static-components` 2. These flag
  compiler-readiness issues; promote to `error` after triage (the `set-state-in-effect` and `refs`
  backlogs dominate).

> **Cache caveat:** `eslint --cache` can hide warnings seeded by an earlier `--quiet` run — an initial
> `lint:warn` reported 0 jsx-a11y findings that a `--no-cache` run revealed as 146. Always measure with
> `--no-cache`.

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
`pnpm build` + `pnpm run check:bundle` (with the compiler flag on and off).
