---
name: mms-shared-package
description: Extends @mms/shared with types, settings defaults, module manifests, translation keys, messaging schemas, and pure utilities shared by frontend and backend. Use when adding shared types, formatDate, formatMoney, parsePhoneNumber, manifests, or moving duplicated logic to packages/shared. Do NOT use for UI components or JSX (use mms-shared-ui or mms-frontend) or Fastify backend-only services (use mms-backend-api).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# @mms/shared Package Workflow

**Rules (norms SSOT):** `mms-dry.md` · `mms-performance.md` §4 · `mms-settings-i18n.md` · `mms-structure-naming.md`.

## When to use

- Adding shared types, Zod DTOs, manifests, or pure utils used by FE and BE
- Moving duplicated pure logic into `packages/shared`
- Changing soft-delete / bulk ID schemas consumed by both apps

## Implementation map

| Concern | Path |
|---------|------|
| API DTOs | `packages/shared/src/schemas/api.dto.ts` (`softDeleteBodySchema`, `bulkIdsBodySchema`) |
| Soft-delete helpers | `packages/shared/src/core/softDelete.ts` |
| Manifests | `packages/shared/src/**/*ModuleManifest.ts` (per-domain folders) |
| Domain folders | per-domain folders under `packages/shared/src/` (`core`, `auth`, `contacts`, `finance`, `settings`, `branding`, `messaging`, `i18n`, `erd`, …) — the `src/` root holds only `index.ts` |
| Barrel | `packages/shared/src/index.ts` (named exports; extra subpaths only `./tenantUtils` + `./translations/{en,ar,ur,fa}`) |

## 1. Architectural Boundaries & Purity

- Pure TypeScript only — no React, DOM, Fastify, Drizzle, DB, or `node:*`.
- Environment-bound helpers (canvas/`document`/`window`/`localStorage`) belong to the consuming app. When shared logic needs runtime data, inject it (see `registerSettingsProvider`, `registerFinanceCurrencyProvider`) instead of reading globals.
- Enforced by `pnpm run check:shared-purity` in CI (`typecheck-lint`). The scanner ignores comments, strings, and test files.
- Named exports via `index.ts` only. Erasable syntax: unions + `as const`; no `enum`/`namespace`.

## 2. Shared Contracts & DTOs

- Write Zod schemas use `.strict()`; sanitize with `safeString`.
- Export paired `Insert*Dto` / `Update*Dto` / `*ResponseDto`.
- Dates: `isoDateSchema` / `isoDateOrEmptySchema` + `compareIsoDates()`.
- Soft-delete: `softDeleteBodySchema`, `bulkIdsBodySchema` (max 500), `isQueryFlagTrue()` for `includeDeleted`.
- Modules declare `*ModuleManifest.ts` (permissions, routes, `softDelete` config).

## 3. Workflow & Verification

1. Place models in the matching domain folder under `packages/shared/src/` (`*Types.ts` / `*Schemas.ts`) — never the `src/` root.
2. Add pure utilities to `packages/shared/src/core/utils.ts` (e.g. `formatDate`, `formatMoney`, `parsePhoneNumber`).
3. Export from `index.ts` with JSDoc on public symbols.
4. Verify:

```bash
bash .agent/skills/mms-shared-package/scripts/check-shared-exports.sh   # = pnpm run check:shared-purity (CI)
pnpm run check:shared-structure                                         # de-flattening ratchet (CI)
pnpm typecheck
```

## References

- Shared Package Guidelines & Export Standards: `references/shared-package-guidelines.md`

## Related skills

`mms-schema-migrate`, `mms-backend-api`, `mms-settings-i18n`, `mms-shared-ui`.
