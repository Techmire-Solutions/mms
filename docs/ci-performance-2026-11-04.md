# CI/CD performance review — 2026-11-04

Speed, cost and deployment-latency review of every GitHub Actions workflow under
`.github/workflows/` plus the two composite actions, with the optimizations that landed in the
same pass. Numbers come from the live run history, not estimates:

- `41830881737` — full `main` push (`30abb1b4`), the slowest recent run.
- `41861773175` — `main` push (`e4fa959`).
- `41849606318` — changed-scope PR run.
- `41866053122` — the successful deploy of `e4fa959`.
- Caches API — `GET /repos/{owner}/{repo}/actions/caches`.

## Baseline (measured)

| Signal | Value |
| --- | --- |
| CI wall clock (`main` push) | **564 s** (first job 12:37:32 → `CI Gate` 12:46:57) |
| Slowest E2E leg | **519 s** — `a11y (2/2)`, of which 444 s is the test step |
| E2E test steps | a11y **444 s / 173 s**; chromium **96 s / 68 s** |
| `Typecheck, Lint & Ratchets` | **193 s** — setup 26, typecheck 31, lint 65, `lint:warn` 2–75, Prettier 45, ratchets ~10 |
| `Build & Release Artifact` | 142 s (setup 26 + build ~100 + checks) |
| `merge-reports` | 34 s, of which 19 s is a full workspace install |
| Coverage gates | 46 s / 40 s, each with a full install |
| Turbo caches | **8,529 MB** in 11 entries — five `build` entries at 1.58–1.64 GB each |
| Playwright / pnpm caches | 279 MB / 203 MB (total cache usage **9,011 MB of a 10 GB cap**) |
| Deploy | **55 s** — 26 s remote deploy, 8 s public verify, 6 s SCP, 4 s checkout, 4 s provenance |
| CI → deploy event hop | **3–5 s** on four consecutive deploys |

Two structural causes dominated: **E2E shard balance** (Playwright 1.64 splits a project's test
list into contiguous slices, so the 310 s `a11y-shell.spec.ts` always lands on one runner) and an
**append-only Turbo cache** (per-commit key + the whole `.turbo` directory archived each run).

## Optimizations

### Cache: bounded Turbo archive + incremental tool caches (`.github/actions/setup-mms/action.yml`)

Bottlenecks:

- The cache key included `github.sha` and archived all of `.turbo`; restoring the previous snapshot
  and saving the union made each entry grow (1.58 → 1.71 GB over five commits), consuming 8.0 GB of
  the 10 GB budget and repeated multi-GB uploads every run.
- Per-package TypeScript (`node_modules/.cache/tsc`) and ESLint (`node_modules/.cache/eslint`)
  caches were never restored, despite `tsc --incremental` and `eslint --cache-strategy content`.

Changes:

- Cache `.turbo/cache`, `apps/*/node_modules/.cache/{tsc,eslint}`, `packages/*/…`, `e2e/…` only.
- Key adds `-v2-`, and the restore keys are `-v2-`-scoped too, so the pre-v2 >1 GB snapshots are
  never restored again and age out by LRU eviction instead of being re-imported.
- New prune step after restore runs `node scripts/ci/prune-turbo-cache.mjs --max-mb 350
  --max-age-days 14`, so the post-job save is bounded. New `scripts/ci/prune-turbo-cache.mjs`
  groups `<hash>.tar.zst` / `-meta.json` / `-manifest.json` triplets, keeps the newest entries up to
  the cap, always keeps the newest entry, and drops entries older than the age limit; covered by
  `scripts/ci/prune-turbo-cache.test.mjs`.
- New `install-filter` input for report/coverage jobs (`pnpm install --filter "<expr>"`), passed via
  `env` (no expression injection into the shell).

```yaml
    - name: Cache Turbo and tool caches
      uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
      with:
        path: |
          .turbo/cache
          apps/*/node_modules/.cache/tsc
          apps/*/node_modules/.cache/eslint
          packages/*/node_modules/.cache/tsc
          packages/*/node_modules/.cache/eslint
          e2e/node_modules/.cache/eslint
        key: turbo-${{ runner.os }}-${{ inputs.turbo-cache-scope }}-${{ hashFiles('pnpm-lock.yaml') }}-v2-${{ github.sha }}
        restore-keys: |
          turbo-${{ runner.os }}-${{ inputs.turbo-cache-scope }}-${{ hashFiles('pnpm-lock.yaml') }}-v2-
          turbo-${{ runner.os }}-${{ inputs.turbo-cache-scope }}-v2-

    - name: Prune Turbo cache
      shell: bash
      run: node scripts/ci/prune-turbo-cache.mjs --dir .turbo/cache --max-mb 350 --max-age-days 14
```

Validated locally against the real 2.6 GB cache: `--max-mb 350` keeps **911 entries (350 MB)** and
removes 8,595 entries / 25,783 files (2.2 GB) in **0.13 s**.

Expected: setup per job 26–31 s → ~20 s; typecheck 31 s → ~8 s; full ESLint 65 s → ~15 s on
changed commits; cache footprint 9.0 GB → < 1.5 GB; upload per run 3.4 GB → < 0.6 GB.

### `ci.yml`

Bottlenecks:

1. E2E critical path 519 s with a 444 s leg (shard skew, not test volume).
2. `merge-reports` (reporting only) sat on the gate's tail: `CI Gate` waited ~34 s for it.
3. `lint:warn` re-runs all of frontend ESLint (2–75 s) even though `continue-on-error: true`.
4. Full-repo Prettier (45 s) on every PR.
5. Full workspace installs in the report/coverage jobs.

Changes:

- **E2E matrix** — explicit `include`: 1 chromium leg (`1/1`) + 4 a11y legs (`1–4/4`). Measured
  contiguous-slice balance for this suite: a11y 2 shards → 425 s max, 3 → 281 s, **4 → 245 s**,
  5 → 197 s; chromium total 129 s, so one leg stays off the critical path and removes a runner.
- **Gate tail** — `merge-reports` removed from `ci-gate.needs` and its result checks/summary; the
  E2E jobs themselves remain required. The report still renders and uploads.
- **Lint warning pass** — `if: github.event_name != 'pull_request'`, so PRs stop paying for a
  non-blocking duplicate ESLint traversal.
- **Prettier** — PRs use `scripts/ci/format-changed.sh "<base-sha>"` (NUL-safe, `ACMR` filter,
  full-check fallback when the base is unavailable). Pushes to main and formatting-config edits
  still run the full `pnpm format:check`.
- **Slim installs** — `merge-reports` → `e2e-tests...`; frontend coverage → `mms-frontend...`;
  backend coverage → `mms-backend...`.
- Playwright binary cache key now includes `pnpm-lock.yaml`.

```yaml
    strategy:
      fail-fast: false
      matrix:
        include:
          - project: chromium
            shardIndex: 1
            shardTotal: 1
          - project: a11y
            shardIndex: 1
            shardTotal: 4
          # … a11y 2-4/4
```

```yaml
      - name: Formatting (Prettier)
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
        run: |
          if [ -n "${BASE_SHA}" ] \
            && ! git diff --name-only "${BASE_SHA}...HEAD" | grep -qE '^(\.prettierrc|\.prettierignore|\.editorconfig)'; then
            bash scripts/ci/format-changed.sh "${BASE_SHA}"
          else
            pnpm format:check
          fi
```

Expected: CI 564 s → **~325 s (−42 %)**; slowest E2E leg 519 s → ~305 s; PR run 546 s → ~320 s. Runner
minutes stay flat (~41 min/push): the two extra a11y legs replace a chromium leg and lint/Prettier
work, while the wall clock drops by four minutes.

### `e2e-nightly.yml`

Measured full-suite slices (`97` tests; chromium 986 s, a11y 652 s): chromium 4 shards → 387 s max,
a11y 2 shards → 404 s max, both well inside the 60-minute timeout. Wall clock is not user-facing and
the nightly runs off-peak, so the matrix is unchanged. Only the report job switched to the slim
`e2e-tests...` install and the Playwright cache key learned the lockfile.

### `deploy.yml` — no change needed

Deploy is already 55 s end-to-end with near-zero downtime: PM2 cluster `startOrReload` after
migrations, Apache graceful reload, prebuilt 17.2 MB artifact, provenance verified from the CI run,
and a 3–5 s event hop. The deployment-latency lever is the CI critical path above. A
`workflow_call` refactor was rejected: folding deploy into `ci.yml` would let a cancelled CI run
interrupt a live production deploy.

### Thin workflows — no change

`pr-title.yml` (9 s), `ops-audit.yml`, `production-apache-isolate.yml`, `renew-tls-cert.yml` are
single-job, dispatch/PR-metadata only, install nothing, and are dominated by runner start-up. There
is no setup or matrix to trim.

### Not applicable

No Dockerfile, Docker-layer build, pip, Cargo, npm or yarn workload exists; pnpm is the only package
manager and its store cache (`node-cache`, 203 MB) was already enabled via `setup-node`.

## Estimated gains (summary)

| Workflow / component | Change | Estimated effect |
| --- | --- | --- |
| `ci.yml` | 1 chromium + 4 a11y legs; `merge-reports` off the gate tail; PR-only Prettier delta; `lint:warn` main-only; slim report/coverage installs | CI **564 s → ~325 s (−42 %)**, PR **546 s → ~320 s**, slowest E2E leg **519 s → ~305 s** |
| `setup-mms` (composite) | `.turbo/cache` only; tsc/eslint caches; prune to 350 MB; `-v2` restore scoping; install filter | setup **26–31 s → ~20 s**/job, typecheck **31 s → ~8 s**, ESLint **65 s → ~15 s**, cache **9.0 GB → < 1.5 GB**, upload **3.4 GB → < 0.6 GB** per run |
| `e2e-nightly.yml` | Slim report install, lockfile in the Playwright cache key | ~10 s less per night; cache correctness |
| `deploy.yml` | None needed | **55 s** deploy, 3–5 s event hop, near-zero downtime (measured) |
| `pr-title.yml`, `ops-audit.yml`, `production-apache-isolate.yml`, `renew-tls-cert.yml` | None | 9–15 s single-job runs; start-up dominated |

Files changed: `.github/actions/setup-mms/action.yml`, `.github/workflows/ci.yml`,
`.github/workflows/e2e-nightly.yml`, `scripts/ci/prune-turbo-cache.mjs`
(+ `scripts/ci/prune-turbo-cache.test.mjs`), `scripts/ci/format-changed.sh`, this document and the
`docs/README.md` index entry.

## Shard-tuning runbook

1. Download the merged report from the latest run:
   `gh run download <run-id> -n playwright-html-report -D /tmp/pwreport`.
2. The report is a single HTML file with a base64 zip in
   `<template id="playwrightReportBase64">`; extract `report.json` + per-test JSON.
3. Order tests by `report.json.files[].tests[]`, sum each test's result duration, and simulate
   contiguous slices (`ceil(n/k)` per bucket) for candidate shard totals.
4. Pick the smallest total whose max slice stays under the current critical path; update the
   `ci.yml` matrix `include` list and this document. Re-tune when a suite grows by >20 %.

## Verification

- `pnpm run test:scripts` (prune selection tests), `actionlint` (CI's pinned image), `zizmor
  --min-severity medium`, `pnpm format:check`, `pnpm run check:docs`, `pnpm ci:local`.
- Post-merge acceptance: next full `main` push **CI ≤ 360 s** (target ~325), slowest E2E leg
  **≤ 330 s**, deploy **≤ 90 s**, every Turbo cache entry **≤ 400 MB**, repo cache total **≤ 2 GB**,
  pnpm/Playwright caches still present after three runs.
- If the slowest leg exceeds 330 s, bump a11y to 5 shards (measured 197 s) or split
  `a11y-shell.spec.ts`; if slim installs break a report job, drop that one `install-filter`.
- Rollback: revert the PR; the cache key is versioned (`-v2`), so reverting keys is safe.
