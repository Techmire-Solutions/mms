# scripts/

Repository tooling: quality gates, deploy/ops, and one-off maintenance. Entry points
are wired from the root `package.json`, `.github/workflows/*`, and `.githooks/*`.

## Conventions

| Language     | Where                       | Run via                                        |
| ------------ | --------------------------- | ---------------------------------------------- |
| `.mjs` (ESM) | repo root `scripts/*.mjs`   | `node scripts/<name>.mjs` (gates, ratchets)    |
| `.sh` (bash) | root + `deploy/ops` subdirs | `bash scripts/<name>.sh` (deploy/ops)          |
| `.ts`        | `scripts/i18n/` only        | `tsx scripts/i18n/<name>.ts` (via a workspace) |
| `.cjs`       | `eslint-ts-compat.cjs` only | preloaded with `node -r` for ESLint            |

Rule of thumb: **repo-root `scripts/` = the wired `pnpm run check:*` / `sync:*` gates**
(`.mjs`); everything else lives in a subdirectory (`ci/`, `i18n/`, `lib/`, `production/`,
`apache/`, `codemod/`). Do not add ad-hoc scripts to the root.

## Quality gates (root `package.json`)

`check:code-norms`, `check:frontend-structure`, `check:shared-structure`, `check:shared-purity`,
`check:backend-boundaries`, `check:backend-structure`, `check:db-projections`,
`check:migration-indexes`, `check:migrations-forward-only`, `check:faculty-domain`,
`check:work-directory`, `check:bundle`, `check:i18n`, `check:secrets`, `check:docs`,
`verify:rules`, `sync:skills-index`.

Most gates are **ratchets**: a `BASELINE` object in the script grandfathers known debt and
fails on regressions. Lower a baseline (never raise it) as debt is paid down.

## Subdirectories

- `ci/` — local CI + branch-protection tooling (`local-ci.sh`, `lint-changed.sh`, …); `ci/remote/`
  holds scripts streamed to the production host.
- `i18n/` — translation completeness + one-off localisers (`.ts`, run via `tsx`).
- `lib/` — shared helpers for the gates (`.mjs`) and shell libs (`.sh`).
- `production/`, `apache/` — VPS bootstrap/backup and Apache vhost management.
- `codemod/` — `move-modules.mjs`, a manual codemod for bulk module moves.
