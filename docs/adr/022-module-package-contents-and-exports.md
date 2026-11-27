# ADR-022: Module package contents and audience-separated export contract

- **Status:** Accepted
- **Date:** 2026-11-27
- **Deciders:** Backend/platform maintainers

## Context

Moving a domain into a package only helps if the package cannot be used as a grab-bag. A single barrel export
would let a frontend app import backend repositories, a tenant page import a platform-only view, or one
module reach into another module's internals. The migration needed a package shape that is explicit,
audience-separated and mechanically checked.

## Decision

1. **Fixed internal shape.** Every `packages/modules/<slice>/` contains
   `src/shared/` (DTO re-exports, role/permission constants, pure policy), `src/backend/`
   (`repository/{,db}`, `use-cases`, `routes`, `services`, `jobs`, `ports.ts`, `deps.ts`) and
   `src/frontend/{components,tenant,platform}` (audience-scoped components, hooks and views).
2. **Explicit audience-separated exports.** `package.json#exports` lists only entry points such as
   `./shared`, `./backend/tenant`, `./backend/use-cases`, `./backend/repository`, `./backend/routes`,
   `./backend/services`, `./backend/jobs`, `./backend/ports`, `./backend/deps`, `./frontend/tenant`,
   `./frontend/platform`. There is intentionally **no root `"."` export** — a consumer must choose an
   audience.
3. **Backend ships built output; frontend ships TS source.** Backend subpaths resolve to `dist/`, compiled by
   the package's `tsc -p tsconfig.build.json`; frontend subpaths stay TypeScript source for the Vite apps.
4. **Audience direction is one-way.** `frontend/tenant` never imports `frontend/platform` and vice versa; apps
   never import a module's `backend/*` from a frontend file; modules never import apps or other modules.
5. **The contract is tested.** `scripts/check-module-boundaries.mjs` and `scripts/ci/module-audience-boundaries.test.mjs`
   assert these rules; a module that adds a subpath or collapses an audience fails the gate.

## Consequences

- Import sites document intent (`@mms/mod-attendance/backend/tenant` vs `/frontend/tenant`).
- Package-manager exports keep the boundary honest at resolution time, not only at review time.
- Build order is simple: backend `dist` per module, frontend source consumed by the two apps.

## Enforcement

- `package.json#exports` in every `packages/modules/<slice>`
- `scripts/check-module-boundaries.mjs`
- `scripts/check-topology.mjs`
- `scripts/ci/module-audience-boundaries.test.mjs`
- `packages/modules/README.md`
