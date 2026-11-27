# ADR-019: Vertical modules own their domain; cross-domain calls go through ports

- **Status:** Accepted
- **Date:** 2026-11-27
- **Deciders:** Backend/platform maintainers

## Context

Before the extraction, every business domain lived under `apps/api/src/<domain>/` and domains imported each
other directly (`students` → `contacts`, `enrollments` → `sessions`, `attendance` → `sessions`/`enrollments`/
`notifications`, `tasks` → `notifications`/`messaging`, `platform` → `iam`/`audit`/`contacts`). The dependency
graph was a cycle-prone ball of mud with no enforceable boundary: a repository change in one domain could
require a migration in three others, and the same SQL was reachable from several layers.

## Decision

1. **One bounded context per package.** Every business domain is a workspace package
   `@mms/mod-<slice>` under `packages/modules/`, containing `src/{shared,backend,frontend}`. `apps/api/src`
   keeps only kernel/composition code (`app.ts`, `bootstrap`, `config`, `db`, `lib`, `middleware`, `plugins`,
   `routes` for app-level public/auth composition, `scripts`, `services`, `worker`, `__tests__`) plus the
   `modules/<slice>/adapters.ts` port bindings.
2. **No module imports another module.** A domain that needs data or behaviour from another domain declares a
   **port** in its own `backend/ports.ts` and resolves it through a delegate layer (`backend/deps.ts`); the
   app composition root (`apps/api/src/modules/<slice>/adapters.ts`) binds that port to the provider module
   or to an app service. This is the same ports-and-adapters rule as ADR-015, raised from the storage layer to
   the domain boundary.
3. **`moduleId` is persisted identity.** Workspace grants, i18n keys and `TENANT_APP_ROUTE_ACCESS` reference
   the slice name; it must not be renamed when the package is created, and the audience-separated exports must
   not be collapsed into a single barrel.
4. **Enforcement is a ratchet, not a convention.** `scripts/check-module-boundaries.mjs` asserts the audience
   import rules (shared → contracts; backend → contracts/db/be-core; frontend → contracts/fe-core/ui; no
   module → module, no app imports from a module), and `scripts/check-topology.mjs` asserts that every
   `packages/modules/<slice>` is declared in the transitional layout and exports its audiences.

## Consequences

- 21 modules own every backend domain; the app backend has no business-domain directory left.
- Cross-domain coupling is visible: each edge is a named port with one binding site, so a behaviour change is
  reviewed where it happens instead of leaking through deep imports.
- Adding a domain means scaffolding a package, declaring ports and an adapter binding — a mechanical, reviewed
  path rather than another folder in `apps/api`.

## Enforcement

- `scripts/check-module-boundaries.mjs`
- `scripts/check-topology.mjs`
- `scripts/ci/module-audience-boundaries.test.mjs`
- `packages/modules/README.md`
