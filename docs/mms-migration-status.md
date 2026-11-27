# Monorepo Migration — Status

Living status for [`docs/monorepo-migration-plan.md`](./monorepo-migration-plan.md) (P0–P9).
**Last verified:** 2026-11-27 · `pnpm turbo run build typecheck lint` = **90/90 green** · all 8 ratchets PASS · tenant bundle 702 chunks / 0 platform markers.

## Topology (current)

```
apps/            api · tenant-web · platform-web
packages/        contracts · db · be-core · fe-core · ui
packages/modules/ 21 audience-separated module packages
```

Module packages (21): accounting, analytics, attendance, audit, billing, contacts, documents,
enrollments, examinations, faculty, hasanat, iam, messaging, notifications, obligations, platform,
question-bank, sessions, students, tasks, workshops.

`apps/api/src` holds **no module directories** — only `routes/` (composition root), `modules/*/configure.ts`
(port wiring), `plugins/`, `middleware/`, `services/`, `lib/`, `worker/`, `bootstrap/`, `config/`, `db/`, `scripts/`.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| P0 | Audit + plan | ✅ complete (`monorepo-migration-plan.md` §8 baseline) |
| P3 | `packages/contracts` / `db` / `be-core` / `fe-core` / `ui` | ✅ complete |
| P4–P6 | Extract every vertical into `@mms/mod-<slice>`; reinvert dependencies behind ports | ✅ **21/21 modules** |
| P7 | `apps/api` thin composition; canonical `/api/tenant/<m>` + legacy `/api/<m>` | ✅ **complete** — 16 tenant modules mounted through `mountModuleDescriptor` (canonical `/api/tenant/<m>` + legacy `/api/<m>` with `Deprecation`/`Sunset`); platform routes already absolute `/api/platform/...` |
| P8 | `apps/tenant-web` / `apps/platform-web` shells | ✅ **complete** — tenant-web: 0 platform files, 702-chunk dist, **0 platform markers**; platform-web: **0 real `frontend/tenant` imports**, isolation baseline **0**; 4 modules expose `frontend/platform` |
| P9 | Docs, permanent ratchets, legacy removal | ⚠️ **substantially complete** — this doc, ADRs 019–022, and **four** ratchets (`package-boundaries`, `web-app-isolation`, `routes-inventory`, `fe-core-boundaries`) landed; the legacy `/api/<m>` removal is deliberately deferred until clients migrate |

## Ratchets (enforced)

| Gate | Purpose | Status |
|---|---|---|
| `check:topology` | declared apps/packages only; no module root export | ✅ |
| `check:module-boundaries` | module audience rules; module→module banned | ✅ |
| `check:backend-boundaries` | backend layer direction | ✅ |
| `check:core-packages` | `contracts`/`db`/`be-core`/`fe-core`/`ui` purity | ✅ |
| **`check:package-boundaries`** | import-specifier direction for the five kernel packages | ✅ **new** |
| **`check:web-app-isolation`** | neither web app imports the other; audience barrels respected (baseline-frozen) | ✅ **new** |
| **`check:routes-inventory`** | every module with a backend router is mounted by `apps/api` | ✅ **new** |
| `check:code-norms`, `check:frontend-structure`, `check:shared-ui`, `check:shared-purity`, `check:money-safety`, `check:accounting-route-*`, `check:finance-contract-parity`, `verify-rules-integrity` | existing gates | ✅ |

## Remaining work (ordered)

1. **P7 dual mount** — strip the internal `{ prefix: "/api/<m>" }` from the 10 module routers
   (`students`, `faculty`, `billing`, `enrollments`, `attendance`, `sessions`, …), then mount each
   descriptor twice from `apps/api/src/compose.ts` (`/api/<m>` legacy with `Deprecation`/`Sunset`,
   `/api/tenant/<m>` canonical). Update `MODULE_ROUTE_ACTION_RULES` and the OpenAPI baseline.
2. **P8 platform-web retarget** — create `frontend/platform` audiences for contacts, messaging, faculty,
   accounting, platform, iam, analytics; drive the 285 frozen violations to zero, re-freeze as empty,
   then flip the ratchet to zero-tolerance.
3. **P8 e2e split** — second `webServer` (`platform` :5174) + `tenant`/`platform`/`a11y` projects.
4. **P9 tail** — `check:fe-core-boundaries`, ADRs 019–022, README/`SYSTEM_ARCHITECTURE.md`/`docs/architecture.md`
   rewrite, then remove the legacy `/api/<m>` mounts and the `Deprecation`/`Sunset` headers.

## Verification commands

```bash
pnpm turbo run build typecheck lint
pnpm run check:topology && pnpm run check:module-boundaries && pnpm run check:backend-boundaries
pnpm run check:package-boundaries && pnpm run check:web-app-isolation && pnpm run check:routes-inventory
node scripts/verify-rules-integrity.mjs
```
