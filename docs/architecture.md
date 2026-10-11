# MMS Architecture & Repository Structure

This document is the **Single Source of Truth (SSOT)** for how the monorepo is
laid out and how to decide **where a piece of code belongs**. It complements the
top-level [`README.md`](../README.md) and the package-level guides.

---

## 1. Monorepo topology

```
mms/
├─ apps/
│  ├─ backend/      # Fastify 5 API + BullMQ worker (Node 24)
│  │  └─ src/
│  │     ├─ routes/      # HTTP (common/auth/platform/tenant)
│  │     ├─ services/    # use-cases & orchestration
│  │     ├─ db/          # schema, migrations_drizzle, repositories, document store
│  │     ├─ middleware/  # auth / csrf / uploader
│  │     ├─ plugins/     # Fastify plugin wiring (security, http, csrf, telemetry)
│  │     ├─ lib/         # shared backend helpers (no domain)
│  │     ├─ worker/      # BullMQ queues, processors, templates
│  │     └─ validation/  # zod request schemas
│  └─ frontend/      # React 19 + Vite 8
│     └─ src/
│        ├─ components/      # SHARED cross-surface UI primitives (the DRY layer)
│        ├─ platform/        # apex admin console
│        │  ├─ components/   ├─ pages/   ├─ hooks/   ├─ lib/   ├─ routes/
│        ├─ tenant/          # madrasa workspace app
│        │  ├─ components/   ├─ features/{module}/   ├─ pages/   ├─ hooks/
│        └─ lib/             # app shell config (apiClient, routes, i18n)
├─ packages/
│  └─ shared/        # @mms/shared — version-catalog-free contract/DTO/format layer
│     └─ src/        # (flat today — see §4 for recommended organization)
├─ e2e/              # Playwright E2E (sharded in CI)
├─ scripts/          # dev/ops/deploy shell + tsx scripts
├─ .github/workflows/# ci.yml, deploy.yml, production-apache-isolate.yml
└─ docs/             # architecture, migration plans, dependency notes
```

## 2. Package boundaries

| Package | Owns | Must **not** contain |
|---|---|---|
| `@mms/shared` | shared **types/DTOs/zod schemas**, pure **format/validate/derive** helpers used by ≥2 packages, i18n packs, shared constants/contracts | UI components, I/O, runtime deps on app internals |
| `apps/backend` | HTTP API, auth/security, persistence, background jobs | React/DOM, browser-only code |
| `apps/frontend` | UI, client state (Query), the **shared component library** | server secrets, DB access |
| `e2e` | Playwright specs/helpers | app logic |

**Decision rule:** if ≥2 packages need a type/utility, move it to `@mms/shared` and
re-export through `packages/shared/src/index.ts`. If ≥2 **UI surfaces** need a
component, put it in `apps/frontend/src/components/**` and import via `@/components/...`.

## 3. Conventions

- **DRY / SSOT:** shared components and helpers live in ONE place. The platform
  must reuse tenant/shared components (e.g. `SidebarNavItem`, `UserAvatar`,
  `AppFooter`, `FormModal`, `EmptyState`, `StatusBadge`, `ModuleCommandMetricsGrid`,
  `ConfirmAlertDialog`) rather than re-implementing them. If a shared primitive is
  missing a capability, extend the shared primitive (e.g. the labeled `CopyBtn`
  variant) instead of forking.
- **Platform vs tenant chrome:** the platform console and the tenant workspace are
  distinct surfaces, but both are built from the shared `src/components/**` layer;
  only truly surface-specific chrome lives under `platform/` / `tenant/`.
- **Domain grouping:** keep feature code together by module (backend `services/`,
  `routes/tenant/<module>/`, `db/repositories/`, frontend `tenant/features/<module>/`).
- **Strictness:** compiler strictness is centralized in [`tsconfig.base.json`](../tsconfig.base.json);
  do not scatter flags across package tsconfigs.
- **Editor config / npm:** `.editorconfig` and `.npmrc` are the base; match them.

## 4. `@mms/shared/src` — current state & recommended target

Today `packages/shared/src` is a **flat** file dump (~hundreds of files). External
imports all go through `@mms/shared` (the `index.ts` barrel), so the physical layout
can be reorganized **without changing consumers**. Recommended target structure
(migrate incrementally, a folder at a time):

```
packages/shared/src/
  contacts/        # contact DTOs, normalization, dedupe, validation
  dataTransfer/    # module transfer schemas, import/export SSOT, system metadata stripping
  branding/        # theme tokens, color math, css variable builders
  backup/          # backup envelope/crypto/validation
  messaging/       # messaging types, template helpers
  finance/         # finance/accounting/obligations contracts
  platform/        # apex platform types, RBAC, settings, errors
  auth/            # session policy, DTOs, credentials
  i18n/            # appTranslations{En,Ar,Ur,Fa}, language utils
  __tests__/       # colocate with the folder they test
  index.ts         # unchanged public barrel
```

> ⚠️ **Deferred while another session is actively editing `packages/shared`.** The
> flat layout is a real smell, but physically moving files now would collide with
> in-flight contact/translation work. Move code in small, reviewable PRs.

## 5. Tooling map

| Concern | Tool | Where |
|---|---|---|
| Workspaces + install | pnpm workspace + version catalog | `pnpm-workspace.yaml` |
| Task orchestration / caching | Turborepo | `turbo.json` |
| Compiler strictness | TypeScript base | `tsconfig.base.json` |
| Lint | ESLint (per-package) | `eslint.config.js` (each package) |
| Unit/integration tests | Vitest + coverage thresholds | `vitest.config.ts` (each package) |
| E2E | Playwright (`chromium` + `a11y` projects, 2 CI shards each) | `e2e/playwright.config.ts` |
| CI | DAG: changes → [typecheck-lint, build (release artifact on main), secret-scan, test-frontend, test-backend-unit, test-backend-db (conditional), e2e] → ci-gate | `.github/workflows/ci.yml` |

**Adopted but not yet enforced (need a coordinated dependency+lockfile change, then a one-time `format:write`):**
- **Prettier** — `.prettierrc.json` + `.prettierignore` are committed; `pnpm add -D prettier` then
  run `prettier --write .` (or add a `format` script) to enforce formatting. Add `format:check` to CI.

**In place:**
- **ADR journal** — see [`docs/adr/`](adr/) (decision records for structural choices).

## 6. Where common questions live

- "Where does the platform reuse a shared widget?" → `apps/frontend/src/components/ui/`.
- "Is a type shared?" → `packages/shared/src` barrel.
- "Which table/repo serves this?" → `apps/backend/src/db/schema.ts` + `db/repositories/`.
- "Which route?" → `apps/backend/src/routes/index.ts` registry.
- "Session/timeout policy?" → `packages/shared/src/sessionPolicy.ts` (SSOT).
