# `@mms/eslint-config`

Shared ESLint flat configs plus the architecture-boundary policy SSOT for the MMS
monorepo. Consumers keep a thin `eslint.config.js` and append their own rules
through `extensions` (inserted before `eslint-config-prettier`, which always runs
last).

```js
// apps/api/eslint.config.js
import { createNodeConfig } from "@mms/eslint-config";

export default createNodeConfig({
  files: ["src/**/*.ts"],
  parserOptions: { project: "./tsconfig.json", tsconfigRootDir: import.meta.dirname },
  rules: { "@typescript-eslint/no-floating-promises": "error" },
});
```

```js
// apps/tenant-web/eslint.config.js
import { createReactConfig } from "@mms/eslint-config";

export default createReactConfig({ files: ["src/**/*.{ts,tsx}"], appKind: "tenant" });
```

## Boundary policy matrix (`boundaries/dependencies`, `default: "disallow"`)

| Source element                                                 | May import                                                                                                              |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `apps/api`                                                     | `contracts`, `db`, `be-core`, `tooling`, module backend/shared audiences — **never another app**                        |
| `apps/tenant-web`                                              | `contracts`, `fe-core`, `ui`, `tooling`, module tenant/shared audiences — **never another app, never backend/platform** |
| `apps/platform-web`                                            | `contracts`, `fe-core`, `ui`, `tooling`, module platform/shared audiences — **never another app, never backend/tenant** |
| `packages/modules/*/src/shared`                                | `contracts`, `tooling` — **never an app or another module**                                                             |
| `packages/modules/*/src/backend`                               | `contracts`, `db`, `be-core`, `tooling`, own shared — **never an app**                                                  |
| `packages/modules/*/src/frontend/{tenant,platform,components}` | `contracts`, `fe-core`, `ui`, `tooling`, own shared/components — **never an app**                                       |
| `packages/fe-core`                                             | `contracts`, `ui`, `tooling`                                                                                            |
| `packages/be-core`                                             | `contracts`, `db`, `tooling`                                                                                            |
| `packages/db`                                                  | `contracts`, `tooling`                                                                                                  |
| `packages/ui`                                                  | `contracts`, `tooling`                                                                                                  |
| `packages/contracts`                                           | `tooling`                                                                                                               |
| `e2e`                                                          | `contracts`                                                                                                             |
| `tooling/*`                                                    | `tooling/*`                                                                                                             |

The `check:core-packages` ratchet independently enforces the five core packages'
workspace-import sets (`contracts` leaf; `db → contracts`; `be-core → contracts/db`;
`fe-core → contracts/ui`; `ui → contracts` plus its no-router/API rules).

Additional hard rule: a tenant app may never import the platform console. Element
policies deny `apps/platform-web` with a custom message, and
`audienceImportRestrictions("tenant")` bans `*/platform` / `*/platform/**`
(`@/platform/**` included) plus module platform/backend audiences.
[`apps/tenant-web/eslint.config.js`](../../apps/tenant-web/eslint.config.js) passes
`appKind: "tenant"` and enables `no-tenant-platform-dynamic-import.cjs`, because
`no-restricted-imports` only inspects static imports while the custom rule covers
`import()` / `require()`.

### Element descriptors

Declared in `boundaries.mjs`, matched against the repo root (found by walking up
to `pnpm-workspace.yaml`) and ordered most-specific-first because the first
matching descriptor wins:

`contracts` (`packages/contracts`) → `db` → `be-core` → `fe-core` → `ui` →
module audiences (`packages/modules/*/src/{shared,backend,frontend/...}`) →
`modules` (`packages/modules/*`) → `app` (`apps/*`) → `tooling` (`tooling/*`) →
`e2e`.

### Deliberate non-goals

- **Tests** are exempt (`boundaries/dependencies: off` for `*.test.*`/`__tests__`):
  ratchet and integration suites legitimately import across elements.
- `boundaries/no-unknown-files` / `no-unknown-dependencies` are off: `scripts/`,
  `docs/`, root configs and `@/`-aliased imports are not workspace elements, and
  the dependency rule already skips unknown local targets by default.
- `checkUnknownLocals` / `checkInternals` stay at their `false` defaults: internal
  imports and unresolved aliases are not boundary crossings.
- `@/`-aliased imports are not Node-resolvable, so element policies skip them;
  the tenant audience rule is specifier-based precisely to catch `@/platform/**`.
- `@mms/ui` legacy aliases are gone: `packages/ui` is a real `workspace:*`
  dependency, so its imports resolve and are enforceable.

## Verification

```bash
pnpm turbo lint typecheck --force   # --force: turbo's hash skips untracked files
pnpm test:scripts                   # boundaries-policy + module-audience probe tests
pnpm run check:core-packages
pnpm run check:module-boundaries
```

## Adding a package or module

1. Add the element descriptor (order matters) in `boundaries.mjs`.
2. Add the policy row for the new element type.
3. Add the package to the README matrix above.
