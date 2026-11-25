---
name: mms-frontend
description: Builds the React frontend (apiClient, routing, providers, Query vs localStorage, Vitest, Playwright). Use when apps/tenant-web, hooks, pages, components, tests. Do NOT use for backend (use mms-backend-api), DTOs (use mms-shared-package), or deploys (use mms-ops-deploy).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-11-02
---

# MMS Frontend Workflow

**Rules (norms SSOT):** `mms-api-interface.md` · `mms-tdd.md` (hook/component tests) · `mms-data-layer.md` · `mms-hooks.md` · `mms-ui-ux-design.md` §4, §8 · `mms-structure-naming.md`.

## When to use

- Editing `apps/tenant-web` pages, components, hooks, or Vite config
- Changing apiClient, providers, routing, or frontend tests

Operational guide for authoring React 19 frontend features, UI components, hooks, and routing.

## 1. Data Layer & API Architecture

- **Query-First**: Dedicated REST entities use TanStack Query facades (`@/tenant/hooks/collections/*`). Legacy document store (`useLiveCollection`) is restricted to non-migrated entities (`mms-data-sync`).
- **HTTP Client**: Route all internal API calls through `@/lib/apiClient` (`apiJson`, `apiFetch`) using cookie sessions (`credentials: 'include'`). Never read tokens from `localStorage`.
- **Bundle Isolation**: Only `VITE_*` variables may be bundled into client code. Server secrets (`DATABASE_URL`, `JWT_SECRET`) are strictly forbidden.
- **WebSocket Invalidation**: Real-time invalidations arrive via `/api/ws` (`TenantLivePushSubscriber`); invalidate query keys rather than mutating local state directly.
- **Read-only projections**: server-owned metadata (`systemTags`, source/key/archived) is display-only. Render it through the locked chip component, never as an editable option; a role mutation that changes projected tags must invalidate the owning collection (`contacts`), not just `faculty`/`students`.
- **Offline/queued writes**: a module that queues failed mutations in `localStorage` scopes the keys by tenant + user (`contactsOutboxStorageKeys`: `mms_{tenant}_…_u:{userId}`), clears them in `clearUserScopedCachesOnLogout`, and flushes single-flight (`contactsSyncOutboxFlush.ts`) so several mounted hooks cannot replay the same queue concurrently. A global key leaks one account's payloads into the next session.
- **One derivation per directory**: resolve entity descriptors, filter chips and column maps once in the directory/controller and pass them down; calling a registry-flattening hook per card multiplies work by row count (`mms-performance.md` §5).
- **Local input state**: debounce search/typing in the leaf control before pushing upward — a controlled input wired straight to the page controller re-renders metrics, directory and lazy tiers on every keystroke.

## 1.1 Document Templates

- **Server-backed layouts:** consume `useDocumentTemplate` / `useDocumentTemplateSave` (`packages/fe-core/src/documentTemplates/`); never persist layouts via `db.ts`, `useLiveCollection`, or localStorage.
- **Concurrency:** saves send the cached `updatedAt`; a 409 keeps the draft, hides Save, shows one conflict toast + banner, and offers explicit reload (`useTemplateSaveConflict`).
- **Render/print:** every preview/print uses `TemplateDocumentPreview` + `printTemplateDocument`; adapters supply payloads, never markup. Full workflow: `mms-document-templates`.

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
cd apps/tenant-web && pnpm typecheck && pnpm lint && pnpm test

# Run E2E smoke tests
pnpm test:e2e tests/responsive-shell.spec.ts
```

- A changed hook/component ships a test that pins the contract it consumes (lean recipient DTO, relative upload URL, post-save unlink), not only a render assertion; mock the data source at its boundary.
- **Facade-mock relocation:** when an implementation moves from `apps/tenant-web` into `@mms/fe-core` or a `@mms/mod-*` package, every app-side `vi.mock("…")` that still targets the old `@/...` path stops intercepting (the moved module now imports fe-core/module paths directly), surfacing as "No QueryClient set" / "useAuth must be used within AuthProvider". Update those mocks to the new import location in the same change.

## References

- Review checklist: `references/frontend-review.md`
- Hook review checklist (every-hook audit): `references/hook-review-checklist.md`

## Related skills

`mms-shared-ui`, `mms-query-factories`, `mms-module-page`, `mms-ui-ux-design`, `mms-testing-e2e`, `mms-data-sync`.
