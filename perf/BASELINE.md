# Frontend Performance Baseline — Public Entry Shell

**Measured:** 2026-11-13 (mobile) · desktop budgets are conservative placeholders, not yet baselined
**Target:** production build of `mms-frontend`, served by `vite preview` on `http://localhost:4173/`
**Tooling:** `@lhci/cli@0.14.0`, Lighthouse mobile emulation (simulated slow 4G: 1.6 Mbps / 150 ms RTT, 4× CPU) and desktop emulation (`preset: desktop`, unthrottled), 3 runs each, median reported.

## What this gate measures

The unauthenticated entry path: `/` resolves the host, paints the inline app-shell skeleton, and (on an apex host) redirects to `/platform/login`. The authenticated tenant dashboard requires a backend session, which CI does not run, so these budgets are a **regression ratchet for the first paint + boot path** — not a dashboard score.

## Results

| Metric                         | Before this PR | After this PR | Budget (error) |
| ------------------------------ | -------------: | ------------: | -------------: |
| Performance score              |             55 |        **59** |           ≥ 55 |
| Largest Contentful Paint (sim) |         7.99 s |     **6.4 s** |        ≤ 7.2 s |
| Total Blocking Time            |         160 ms |  **44–54 ms** |       ≤ 300 ms |
| Script transfer, entry closure |        709 KiB |   **575 KiB** |      ≤ 600 KiB |
| Requests, entry closure        |           ~125 |        **68** |              — |
| Layout shift (CLS)             |              0 |             0 |              — |

“Before” is the same workflow measured against `main` before this PR (upper bound of the three runs); “after” is the median of three local runs of the final build. Script bytes and request counts are deterministic for a build, which is why the byte budget has the tightest headroom.

## Desktop pass

CI also runs an unthrottled desktop pass (`lighthouserc.desktop.cjs`, `settings.preset: desktop`). Desktop lab scores are CI-runner dependent, so its budgets are **conservative placeholders** pending a measured desktop baseline:

| Metric                         | Budget (error) | Rationale                                                                          |
| ------------------------------ | -------------: | ---------------------------------------------------------------------------------- |
| Performance score              |           ≥ 75 | Unthrottled desktop is expected ≥ 90; the floor only catches a boot-path collapse. |
| Largest Contentful Paint       |        ≤ 3.0 s | Unthrottled desktop is expected < 2 s.                                             |
| Total Blocking Time            |       ≤ 200 ms | Unthrottled desktop is expected < 100 ms.                                          |
| Script transfer, entry closure |      ≤ 600 KiB | Deterministic — identical to mobile.                                               |

Ratchet the desktop lab budgets down in the same PR that records a measured desktop baseline (median of 3 CI runs).

## What moved the numbers

1. **Lazy platform shell** — `ApexRoutes` loaded `PlatformPageShell` statically, which pulled the `@shared/ui` barrel (tables, DatePicker, forms, motion) into every apex entry page: 93 chunks. It is now `React.lazy` and only fetched when an authenticated console route renders. Requests dropped ~125 → 68, scripts 709 → 575 KiB.
2. **Deferred dashboard widgets** — `LazyDeferredView` (IntersectionObserver) mounts below-the-fold dashboard widgets on approach instead of during the initial render, cutting initial main-thread work on the dashboard.
3. **Deferred non-critical boot work** — `NetworkStatusIndicator` is `React.lazy`; theme application already ran through dynamic imports; the duplicate render-blocking Google Fonts preload was removed (it fetched the same stylesheet twice).
4. **Path constants split** — `tenantPaths.ts` keeps Lucide/React out of modules that only need tenant URL literals.
5. **Inline boot skeleton** — the `index.html` skeleton mirrors the shell (56 px top bar, banner, KPI grid) so the pre-React paint is stable and CLS stays 0. The skeleton is `aria-hidden` and replaced on mount.

## Budget policy

- Budgets are ratchets: when a change improves a metric, lower the budget in the same PR and update this table.
- Raising a budget is only allowed together with a re-measured baseline and a note explaining why the regression is accepted.
- `resource-summary:script:size` (600 KiB) is the hard bundle guard; the lab metrics are floored at the measured baseline to absorb CI runner variance (desktop floors are conservative until a desktop baseline is recorded).
- The `@shared/ui` barrel import remains a known bundle hazard: any new eager import of `@shared/ui` or `packages/ui/src/index.ts` from an entry-path module reintroduces the chunk graph this PR removed.

## Reproduce

```bash
pnpm --filter mms-frontend build
# Mobile
npx --yes @lhci/cli@0.14.0 autorun --config=./lighthouserc.cjs
mv .lighthouseci .lighthouseci-mobile
# Desktop
npx --yes @lhci/cli@0.14.0 autorun --config=./lighthouserc.desktop.cjs
mv .lighthouseci .lighthouseci-desktop
# Writes lhci-comment.md with both Mobile and Desktop sections
node scripts/perf/format-lhci-comment.cjs
```

`pnpm ci:local:full` (or `pnpm ci:local --with-lighthouse`) runs the steps above automatically after the production build.

`scripts/perf/format-lhci-comment.cjs` derives its pass/fail budgets from `lighthouserc.cjs` (mobile) and `lighthouserc.desktop.cjs` (desktop), so the PR comment's verdict always matches the CI gate (median of each run set). There is no `upload` target: results stay local to the run and the PR comment is the durable artifact.

`scripts/perf/run-lighthouse.mjs` is the local Windows/macOS helper for one-off mobile + desktop reports; CI uses the LHCI config above. The helper invokes the unpinned `npx lighthouse` CLI (not `@lhci/cli`), so its local numbers can drift slightly from CI.
