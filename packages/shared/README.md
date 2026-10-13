# @mms/shared

The single source of truth for cross-package **types, DTOs, zod schemas, constants,
pure helpers, i18n packs**, and the ts-rest contracts used by `apps/backend` and
`apps/frontend`.

## Rules (see `docs/architecture.md` + `docs/adr/014`)

- Anything needed by ≥2 packages goes here and is re-exported via `src/index.ts`.
- No UI components, no I/O, no runtime deps on app internals — pure, testable code.
- Strictness comes from the root `tsconfig.base.json` (this package `extends` it).

## Layout

Domain-organized. `src/` root holds **only** the public barrel (`index.ts`); everything else
lives under a domain folder (see `docs/architecture.md` §4):

```
src/
├── core/         cross-cutting pure utils (dates, numbers, phone, pagination, csv, title-case…)
├── auth/         tenant, users, RBAC/permissions, platform, workspaces, background jobs
├── contacts/ students/ faculty/ sessions/ enrollments/ examinations/ attendance/ hasanat/ obligations/
├── finance/      accounting, invoices, payments, ledger, money
├── messaging/    sms, whatsapp, email, social channels
├── branding/ settings/ dashboard/ reports/ audit/ backup/ documents/ erd/ demo/
├── i18n/         appTranslations{En,Ar,Ur,Fa} (ADR-001 exemption; one key per line)
├── contracts/    ts-rest contracts      ├── schemas/  zod DTOs
├── dataTransfer/ import/export engine   └── __tests__/ shared cross-cutting suites
└── index.ts      the public barrel
```

Only the barrel and the subpaths declared in `package.json` `exports`
(`tenantUtils`, `translations/{en,ar,ur,fa}`) are importable — never a deep `@mms/shared/src/…`
path. Enforced by `pnpm run check:shared-structure` + `check:shared-purity`.

## Scripts

- `build` — emit declarations to `dist/`
- `typecheck` — `tsc --noEmit`
- `test` — vitest
- `lint` — eslint

Add new exports to `src/index.ts`; keep a co-located `*.test.ts` next to the source.
Place new code in the matching `src/<domain>/` folder — do not add files to the `src/` root.
