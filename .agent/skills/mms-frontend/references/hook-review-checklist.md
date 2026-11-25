# Hook Review Checklist (mms-frontend)

Review checklist for **every** React hook in `apps/tenant-web`. Verdict per file: **OK** / **Fixed** / **Justified exception**. Severity: B0 correctness (fix + regression test), B1 robustness/perf (fix), B2 modernization (fix, non-breaking), B3 style (only trivial). Norms: `mms-hooks.md`, `mms-frontend`, `mms-dry.md`, `mms-performance.md` §4–§5, `mms-tdd.md`.

## B0 — Correctness (fix + regression test)

- [ ] Stale closures over state/props in async callbacks; deps hidden behind `eslint-disable … exhaustive-deps` (restructure to granular deps / refs, never silence).
- [ ] Races: out-of-order async responses (AbortController / ignore-flag), setState-after-unmount, StrictMode double-invocation unsafety.
- [ ] Leaks: `setTimeout`/`setInterval`, listeners, `IntersectionObserver`/`ResizeObserver`, WebSocket subscriptions without cleanup.
- [ ] Query hooks: tenant-scoped cache keys, correct `enabled` gating, `signal` passthrough to `apiFetch`, no ad-hoc polling loops, optimistic updates with rollback, precise invalidation.
- [ ] Derivation logic: NaN/undefined guards, empty-list division, wrong units.

## B1 — Robustness & performance

- [ ] Memoization only where it prevents cascades (`useMemo`/`useCallback`); stable context values.
- [ ] "Derive once" in the controller; never re-derive registries/descriptors per row/card.
- [ ] Debounce search/typing in the leaf control.
- [ ] Single-flight module-level promise for side effects several components can mount (see `contactsSyncOutboxFlush.ts`).
- [ ] LocalStorage keys scoped by tenant + user; cleared in `clearUserScopedCachesOnLogout`.

## B2 — Modern best practices

- [ ] React 19: `useId` for a11y ids; `useSyncExternalStore` for external stores (localStorage / URL / websocket); lazy `useState` init; `useEffect` over `useLayoutEffect` when possible; `useBodyScrollLock` (never manual `document.body.style.overflow`).
- [ ] TanStack Query v5: `queryOptions`/`mutationOptions` factories, tuple keys, `placeholderData: keepPreviousData`, toasts at call site (no global MutationCache bus), invalidate keys over local-state mutation.
- [ ] React Hook Form 7.92: stable `defaultValues`, shared Zod resolvers, no `setValue` loops breaking dirty tracking; reuse the `useZodDraftForm` family.
- [ ] Compiler readiness: no mutation of refs/props/state during render; no incompatible-library callback patterns; keep `react-hooks/set-state-in-effect` at zero (derive during render, lazy-init, or move work to events).
- [ ] Reuse sanctioned hooks (`useDebounce`, `useMediaQuery`, `useSystemThemeListener`, `useIdleTimer`, `useBodyScrollLock`, `useWorkSelection`, `useDirectoryTrashState`, `useWorkDirectoryViewMode`, …) — ban local re-implementations.
- [ ] Cross-feature imports go through `@/tenant/hooks/collections/{module}` facades; platform hooks stay in `@/platform/hooks` and never import tenant code.
- [ ] Strict TS: typed refs, zero `any`; ≤300-line cap per hook file (prefer ≤220).
