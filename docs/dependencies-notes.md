# Dependency security & versioning notes

Operational notes for dependencies that sit outside the normal npm registry
flow or otherwise need explicit maintenance attention.

## xlsx (SheetJS CE) — CDN tarball pin

- `pnpm-workspace.yaml → overrides` pins `xlsx` to
  `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (SheetJS moved off npm
  in 2023; npm's `xlsx` package is stale). It applies to every workspace
  package; the direct dependency in `apps/frontend/package.json` is a `*`
  placeholder — the override is the single source of truth for the version.
- The lockfile pins the tarball integrity; keep `pnpm-lock.yaml` committed and
  never regenerate without checking `pnpm-lock.yaml` still records the
  SheetJS-hosted URL you expect.
- **Update procedure (do at least quarterly):** check
  https://cdn.sheetjs.com for the current release tag, update the override URL
  and lockfile together in one commit, and diff the bundle output
  (`pnpm --filter mms-frontend build` — xlsx is a lazy chunk) plus run the
  export-related frontend tests.
- Removal candidate: the backend already uses `exceljs` and the frontend ships
  `jspdf`; a future refactor could unify exports on those and drop xlsx
  entirely.

## TypeScript 7 + TypeScript 6 dual install

- The workspace compiles with TypeScript 7 (`typescript: ~7.0.2`, the native
  Go port) for build speed.
- `typescript-eslint@8` cannot parse TS 7, so ESLint runs under a TypeScript
  6 alias: `scripts/eslint-ts-compat.cjs` (preloaded via `NODE_OPTIONS=-r` in
  every package's `lint` script) maps `require('typescript')` to
  `typescript-v6` (root `devDependencies`, `npm:typescript@~6.0.3`) for the
  lint process only.
- The shim now hard-fails if `typescript-v6` is missing (previously it
  silently degraded and lint behavior differed per machine). If a future
  typescript-eslint release supports TS 7, remove the shim, the
  `typescript-v6` alias, and this note together.

## Audit overrides and reviewed exceptions

`pnpm audit` is a CI gate (`--audit-level high`), so runtime advisories are patched
promptly and the remaining findings are explicit decisions:

- **Patched via `overrides`** (`pnpm-workspace.yaml`): `fast-uri ^4.2.3`,
  `ip-address >=10.7.4`, `serialize-javascript >=7.1.2` (build tooling only).
- **`nodemailer`** is a direct dependency; keep it on the latest 10.x patch
  (currently `^10.2.1`) — it is the only runtime email transport.
- **`ts-deepmerge@6`** is a *reviewed exception*: the advisory is unreachable
  (static OpenAPI args) and the `>=8` override breaks `/api/openapi.json`; see the
  comment in `pnpm-workspace.yaml`.
- **`deepmerge@4.3.1`** (dev-only, workbox build chain) has a low advisory whose
  `patched_versions` (`>=4.3.2`) was never published on npm; revisit when it is.

When bumping any of these: update the override + lockfile in one commit, run
`pnpm audit`, then the package's unit suite (backend email tests for nodemailer).

## Node version alignment

- CI, Docker, and `engines` all target Node 24 LTS; `.nvmrc` pins 24 so
  `setup-node`/nvm agree with CI. `@types/node` tracks a newer major for
  types-only coverage — bump it in the same PR when bumping the runtime.