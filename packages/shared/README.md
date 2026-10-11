# @mms/shared

The single source of truth for cross-package **types, DTOs, zod schemas, constants,
pure helpers, i18n packs**, and the ts-rest contracts used by `apps/backend` and
`apps/frontend`.

## Rules (see `docs/architecture.md` + `docs/adr/0001`)

- Anything needed by ≥2 packages goes here and is re-exported via `src/index.ts`.
- No UI components, no I/O, no runtime deps on app internals — pure, testable code.
- Strictness comes from the root `tsconfig.base.json` (this package `extends` it).

## Layout

`src/` is currently flat. Target organization by domain (contacts/, branding/,
backup/, messaging/, finance/, platform/, auth/, i18n/) — see `docs/architecture.md`
§4. Migrate incrementally; the public `index.ts` barrel keeps consumers stable.

## Scripts

- `build` — emit declarations to `dist/`
- `typecheck` — `tsc --noEmit`
- `test` — vitest
- `lint` — eslint

Add new exports to `src/index.ts`; keep a co-located `*.test.ts` next to the source.
