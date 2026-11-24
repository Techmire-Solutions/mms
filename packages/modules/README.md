# `packages/modules/*`

Vertical domain slices. Each module is its own workspace package named
`@mms/mod-<slice>` and owns one bounded context end to end.

```text
packages/modules/<slice>/
  src/
    shared/       # DTO re-exports, role/permission constants, pure policy (FE+BE)
    backend/      # Fastify route plugins, service/orchestration, repository ports
    frontend/     # audience-scoped components, hooks, forms and views
      components/ # audience-neutral module widgets
      tenant/     # tenant-console audience
      platform/   # platform-console audience
```

Public exports are **explicit and audience-separated**:

```ts
import ... from "@mms/mod-<slice>/shared";
import ... from "@mms/mod-<slice>/backend/tenant";
import ... from "@mms/mod-<slice>/backend/platform";
import ... from "@mms/mod-<slice>/frontend/tenant";
import ... from "@mms/mod-<slice>/frontend/platform";
```

There is intentionally **no root export** — a consumer must choose an audience.
Backend subpaths compile to Node ESM `dist/`; frontend subpaths are TypeScript
source for the Vite apps. Backend code is never importable by a frontend app.

Rules enforced by `tooling/eslint-config` (`boundaries/dependencies`) plus
`scripts/check-module-boundaries.mjs` and `scripts/ci/module-audience-boundaries.test.mjs`:

- `shared` may import `@mms/contracts` and `tooling/*` only; it must stay pure.
- `backend` may import `@mms/contracts`, `@mms/db`, `@mms/be-core`, `tooling/*`
  and its own `shared`.
- `frontend/*` may import `@mms/contracts`, `@mms/fe-core`, `@mms/ui`, `tooling/*`
  and its own `shared`/`frontend/components`.
- `frontend/tenant` may never import `frontend/platform` (and vice versa).
- A module may never import an app or another module. Cross-module needs go
  through a declared port implemented by the app composition root.
- Frontend apps may never import a module's `backend/*` audience; tenant-facing
  apps may never import `frontend/platform`; platform apps may never import
  `frontend/tenant`.

`moduleId` is the persisted identity used by workspace grants, i18n keys and
`TENANT_APP_ROUTE_ACCESS` — it must not be renamed when the package is created.

See [`docs/monorepo-migration-plan.md`](../../docs/monorepo-migration-plan.md) §5–§7
for the extraction waves and the port boundaries.
