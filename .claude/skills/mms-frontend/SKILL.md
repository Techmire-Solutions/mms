---
name: mms-frontend
description: Builds or modifies the MMS React frontend — apiClient, routing, providers, TanStack Query vs useLiveCollection, Vitest, Playwright, and module file structure. Use when editing apps/frontend, Vite config, frontend hooks, pages, components, or frontend tests. Do NOT use for backend Fastify APIs (use mms-backend-api), shared DTO schemas (use mms-shared-package), or production server configuration (use mms-ops-deploy).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-29
---

# MMS Frontend Workflow

**Rules (norms SSOT):** `mms-api-interface.md` · `mms-tdd.md` (hook/component tests) · `mms-data-layer.md` · `mms-hooks.md` · `mms-ui-ux-design.md` §4, §8 · `mms-structure-naming.md`.

## When to use

- Editing `apps/frontend` pages, components, hooks, or Vite config
- Changing apiClient, providers, routing, or frontend tests

Operational guide for authoring React 19 frontend features, UI components, hooks, and routing.

## 1. Data Layer & API Architecture

- **Query-First**: Dedicated REST entities use TanStack Query facades (`@/tenant/hooks/collections/*`). Legacy document store (`useLiveCollection`) is restricted to non-migrated entities (`mms-data-sync`).
- **HTTP Client**: Route all internal API calls through `@/lib/apiClient` (`apiJson`, `apiFetch`) using cookie sessions (`credentials: 'include'`). Never read tokens from `localStorage`.
- **Bundle Isolation**: Only `VITE_*` variables may be bundled into client code. Server secrets (`DATABASE_URL`, `JWT_SECRET`) are strictly forbidden.
- **WebSocket Invalidation**: Real-time invalidations arrive via `/api/ws` (`TenantLivePushSubscriber`); invalidate query keys rather than mutating local state directly.

## 2. UI Chrome & BiDi Logical Styling

- **Logical CSS**: Enforce Tailwind v4 logical utility classes for seamless RTL/LTR rendering:
  - Padding/Margin: `ps-*`, `pe-*`, `ms-*`, `me-*` (never `pl-`, `pr-`, `ml-`, `mr-`).
  - Positioning: `start-*`, `end-*` (never `left-`, `right-`).
  - Alignment: `text-start`, `text-end` (never `text-left`, `text-right`).
  - Borders: `border-s-*`, `border-e-*`.
- **Shared Chrome Reuse**: Always reuse design system components (`EmptyState`, `FieldErrorMessage`, `WarningCallout`, `BulkSelectionBar`, `DirectoryCard`, `DetailSheet`) and `formStyles` tokens. Form controls and repeatable rows follow the `mms-form-architecture` control decision table (`FormCollectionShell` / `FormListFieldCard` / `FormCardTypeSelect` / `FormSelectWithQuickCreate`).
- **Design Intelligence**: Leverage `ui-ux-pro-max` (`python3 .agent/skills/ui-ux-pro-max/scripts/search.py`) for palettes, typography pairings, stack patterns, and UX guidelines conforming to `mms-ui-ux-design.md` §8.

## 3. Host Isolation & Routing

- **Platform Apex**: Host is locked to English + LTR (`dir="ltr"`). Never reads tenant `settings.language`.
- **Tenant Host**: Multilingual (en/ar/ur/fa) wrapped in `TenantScopedProviders` (`ContactConfigProvider`).
- **Invalid Subdomain**: `TenantBootGate` hard-redirects (`window.location`) to apex `ROUTES.tenantNotFound`. Never mount tenant routes on unknown subdomains.

## 4. Verification

```bash
# Run frontend typecheck, linter, and Vitest suite
cd apps/frontend && pnpm typecheck && pnpm lint && pnpm test

# Run E2E smoke tests
pnpm test:e2e tests/responsive-shell.spec.ts
```

## References

- Review checklist: `references/frontend-review.md`

## Related skills

`mms-shared-ui`, `mms-query-factories`, `mms-module-page`, `mms-ui-ux-design`, `mms-testing-e2e`, `mms-data-sync`.
