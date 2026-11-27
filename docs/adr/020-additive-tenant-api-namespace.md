# ADR-020: Tenant console API lives under an additive `/api/tenant/*` namespace

- **Status:** Accepted — **implemented 2026-11-27** (canonical `/api/tenant/<module>` mounts for every module-owned tenant surface; legacy `/api/<module>` mounts carry `Deprecation` + `Sunset: Wed, 31 Dec 2026 23:59:59 GMT`)
- **Date:** 2026-11-27
- **Deciders:** Backend/platform maintainers

## Context

The module extraction moved routes into `packages/modules/<slice>/src/backend/routes/` but deliberately kept
the existing URL shapes (`/api/accounting`, `/api/students`, `/api/attendance/calendar`, …) so the migration
changed no client behaviour. With twenty modules mounted side by side, the tenant console namespace is
indistinguishable from the app-level kernel routes (`/api/auth`, `/api/workspace`, `/api/uploads`), and the
platform console adds its own `/api/platform/*` tree.

## Decision

1. **Additive namespace.** Tenant-console module routes will be served at `/api/tenant/<module>/…` in
   addition to the legacy `/api/<module>/…` paths. Nothing is removed while the deprecation window is open;
   both mounts resolve to the same module router, so behaviour is identical.
2. **Kernel stays un-prefixed.** `/api/auth`, `/api/workspace`, `/api/uploads`, `/api/db` and the platform
   console tree are not tenant modules and stay where they are.
3. **Deprecation is explicit.** When the legacy mounts are removed, the PR records the `Deprecation`/`Sunset`
   window; today no such headers are emitted.
4. **The route map in `docs/monorepo-migration-plan.md` §P7 is authoritative** for the prefix table; the
   dual mount is tracked there as remaining work.

## Consequences

- Clients can migrate gradually; the module routers are mounted twice with one implementation.
- The coverage test (`apps/api/src/__tests__/moduleAccessCoverage.test.ts`) must classify both prefixes when
  the dual mount lands.

## Enforcement

- `apps/api/src/routes/index.ts` (mount points)
- `apps/api/src/__tests__/moduleAccessCoverage.test.ts` (every route classified and module-gated)
---

**Implementation status:** the dual mount is **not yet implemented**; modules are still served at
`/api/<module>` only. Blueprint P7 remains open for it.
