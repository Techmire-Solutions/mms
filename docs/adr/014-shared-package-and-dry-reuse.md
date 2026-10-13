# ADR 0001: Single `@mms/shared` package + mandatory DRY reuse in the platform

- **Status:** Accepted
- **Date:** 2025
- **Deciders:** Platform/backend maintainers

## Context
A multi-tenant SaaS (tenant workspaces + apex platform console) with a monorepo
(`apps/backend`, `apps/frontend`, `packages/shared`, `e2e`). Frontend code
repeatedly re-implemented shared primitives in the platform surface (dialogs,
avatars, footers, nav items, stat cards, copy buttons, timeouts) instead of
reusing `apps/frontend/src/components/**`, and shared types/helpers were at risk
of duplication across `@mms/shared` and app code.

## Decision
1. `@mms/shared` is the **single source of truth** for any type/DTO/zod schema,
   pure format/validate/derive helper, constant, and i18n pack needed by ≥2 packages.
   Re-export everything through `packages/shared/src/index.ts`.
2. The platform must **reuse** shared components from `apps/frontend/src/components/**`
   (e.g. `SidebarNavItem`, `UserAvatar`, `AppFooter`, `FormModal`, `EmptyState`,
   `StatusBadge`, `ModuleCommandMetricsGrid`, `ConfirmAlertDialog`, labeled `CopyBtn`).
   Extend the shared primitive when a capability is missing; never fork.
3. Compiler strictness lives in the root `tsconfig.base.json`; packages `extends` it.
4. The flat `packages/shared/src` layout is a known smell; target domain subfolders
   (§4 of `docs/architecture.md`). **Deferred** until the active editing session
   lands, to avoid rename conflicts; migrate incrementally.

## Consequences
- Single definition per shared concept; cross-package consistency.
- Safe to reorganize `@mms/shared/src` later (public barrel is unchanged).
- Requires discipline: new shared code goes in `@mms/shared` / `src/components`, not
  forked in the platform.
