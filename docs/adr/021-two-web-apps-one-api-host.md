# ADR-021: Two web apps, one Fastify API host

- **Status:** Accepted
- **Date:** 2026-11-27
- **Deciders:** Frontend/platform maintainers

## Context

The original single SPA (`apps/frontend`, package `mms-frontend`) chose tenant vs platform console from
`window.location.hostname` at runtime. That coupled both consoles into one bundle, forced every platform
dependency into the tenant payload, and made route access, theming and PWA behaviour depend on a runtime
branch. The blueprint's P8 split `apps/frontend` into `apps/tenant-web` and `apps/platform-web`.

## Decision

1. **Separate builds.** `apps/tenant-web` and `apps/platform-web` are independent Vite SPAs with their own
   entry, routing, providers and test setup. They share only `@mms/contracts`, `@mms/fe-core`, `@mms/ui` and
   module `frontend/*` audiences.
2. **One API host serves both.** The Fastify host (`apps/api`) resolves the apex/tenant hostname and serves the
   matching `dist/index.html` from `web-root/{tenant-web,platform-web}` via
   `plugins/registerWebApps.ts`; it never imports an app's `src`.
3. **No cross-console imports.** Tenant-facing code may never import `frontend/platform` (and vice versa);
   the boundary script enforces the audience split.
4. **PWA per app.** The tenant app owns the service worker; the apex console ships none.

## Consequences

- Each console is independently deployable and testable; the tenant bundle no longer carries platform code.
- Host-based serving keeps one origin/API, so cookies and CSRF remain unchanged.
- Shared shells stay in `@mms/fe-core`/`@mms/ui`, not in either app.

## Enforcement

- `apps/api/src/plugins/registerWebApps.ts` (host → dist resolution)
- `scripts/check-module-boundaries.mjs` (audience rules; app → module directions)
- `scripts/ci/local-ci-and-infra-parity.test.mjs` (both apps build in CI)
