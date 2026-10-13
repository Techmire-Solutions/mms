# ADR-015: Backend Ports & Adapters over `db/repositories/`

Status: Accepted (2026-10-13)

## Context

`SYSTEM_ARCHITECTURE.md` §5 described each backend module's storage as
`{module}/repository/{module}Repository.ts` (interface) + `{module}RepositoryAdapter.ts`
("Drizzle ORM implementation"). In reality the adapter contains **no SQL** — it is a thin
`const x: XRepository = { …sqlFns }` binding, and the real Drizzle lives in
`apps/backend/src/db/repositories/**` (249 files, ~34k lines; the only layer importing
`drizzle-orm`). Meanwhile the seam was porous: 48 use-case files and 67 `services/` files
imported `db/repositories/**` directly, so "the use-case depends only on the port" was
documented but unenforced (only the *route* edge was checked, at baseline 0).

## Decision

Adopt and **enforce** an explicit ports-and-adapters seam:

- `{module}/repository/{module}Repository.ts` is the **port** — a types-only interface.
- `{module}/repository/{module}RepositoryAdapter.ts` is the **adapter** — binds the port to the
  SQL functions in `db/repositories/**`. It may contain no `drizzle-orm` / SQL.
- `db/repositories/**` is the **persistence layer** — the only place `drizzle-orm` is imported.
- Enforced direction: `routes → use-cases → port → adapter → db/repositories`.

Enforcement (ratchets, baselines grandfather existing sites and are lowered as the seam tightens):

- `scripts/check-backend-boundaries.mjs` — routes must not import `db/repositories`/`drizzle-orm`
  (baseline **0**).
- `scripts/check-backend-structure.mjs` — `useCaseStorageImports` and `servicesStorageImports`
  ratchets, plus `servicesReexportShims` (0) and `routeAggregatorFiles`.

## Alternatives considered

1. **Move all 34k lines of SQL into `{module}/repository/`.** Would make the doc literal, but a
   ~249-file relocation with no behavioural benefit; rejected as churn.
2. **Delete the adapters and let use-cases import SQL directly.** Removes ~18 files of indirection
   but destroys the DI/test seam and couples business logic to Drizzle; rejected.
3. **Leave as-is (docs only).** The mismatch between doc and code, and the porous seam, would
   persist; rejected.

## Consequences

- The layering is now honest and machine-checked; new direct storage imports fail CI.
- `services/` may not contain pure one-line re-export shims (the 20 that existed were removed;
  canonical paths win).
- The existing 48 use-case / 67 services direct-import sites are grandfathered debt — tighten
  the baselines as they are migrated to the port.
