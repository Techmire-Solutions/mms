---
description: Directory structure, colocation, 300 LOC file limits, and symbol/casing naming conventions
paths:
  - "packages/ui/**"
  - "packages/shared/src/**"
  - "apps/frontend/src/components/ui/**"
  - "apps/frontend/src/platform/components/**"
  - "scripts/**"
---

# MMS File Structure & Naming Conventions

**Workflow skills:** FE feature scaffolding → `mms-frontend` · shared UI governance → `mms-shared-ui` · shared barrels/exports → `mms-shared-package` · module page layout → `mms-module-page`.

## 1. Monorepo & Directory Structure
- **Topology:** `apps/frontend/` (React SPA), `apps/backend/` (Fastify API), `packages/shared/` (`@mms/shared` types/contracts/pure utils), `packages/ui/` (`@shared/ui` design-system primitives and theme tokens), `scripts/` (ops/deploy), `e2e/` (Playwright tests).
- **Frontend Colocation:** Reusable design-system primitives live in `packages/ui` (`@shared/ui`); `apps/frontend/src/components/ui/` holds backward-compatible typed re-exports from `@shared/ui` with zero local component implementations; app-level composites in `@/components/app/`; shared engines/shells (DataTable, Work tier, entity descriptors) in `@/components/common/`; feature-shaped component libs in `@/components/<name>/` (`reports`, `template-editor`, `messageComposer`, `contact-action`, `sequence-numbering`). Generic hooks in `@/hooks/`; UI-presentation helpers in `@/lib/ui/`; shared libs in `@/lib/`. Feature modules live under `tenant/features/{module}/` (`{Module}Page.tsx`, `components/` for UI only, `hooks/`/`lib/` for logic). Cross-feature tenant hooks in `tenant/hooks/`. Platform console lives in `platform/` (`pages/`, `components/`, `hooks/`, `routes/`) and imports primitives directly from `@shared/ui`. Duplicate UI component implementations across consoles are strictly banned. Enforced by `pnpm run check:frontend-structure` and `pnpm run check:shared-ui`.
- **Backend Clean Architecture (ports & adapters):** Domain modules isolate into `{module}/use-cases/**` (business logic + DI composition root) and `{module}/repository/**` — a **port** (`{module}Repository.ts`, types only) plus an **adapter** (`{module}RepositoryAdapter.ts`) that binds the port to the real SQL in `apps/backend/src/db/repositories/**` (the only layer importing `drizzle-orm`). Route files must not import `db/repositories`/`drizzle-orm` (`check:backend-boundaries`, baseline 0); use-case/service storage imports are ratcheted by `check:backend-structure`.
- **`@mms/shared` Layout:** Domain-organized into per-domain folders under `packages/shared/src/` (`core`, `auth`, `contacts`, `students`, `faculty`, `sessions`, `enrollments`, `examinations`, `attendance`, `hasanat`, `obligations`, `finance`, `messaging`, `branding`, `settings`, `dashboard`, `reports`, `audit`, `backup`, `documents`, `erd`, `demo`, `i18n`, plus `contracts`/`schemas`/`dataTransfer`). The `src/` root holds **only** the public barrel `index.ts`. Consumers import `@mms/shared` or the declared subpaths (`tenantUtils`, `translations/{en,ar,ur,fa}`) only. Enforced by `pnpm run check:shared-structure` + `check:shared-purity`.

## 2. Naming Conventions
- **UI-DB Casing Symmetry:** Database columns (`snake_case`), TypeScript identifiers (`camelCase`/`PascalCase`), and UI labels must align semantically. If UI says "Contact Role", DB is `contact_role` and TS is `contactRole` / `ContactRole`. Abbreviations or generic names (`role`) are banned.
- **Protocol Imports & URLs:** Prefix core imports with `node:` (`node:fs/promises`, `node:crypto`, `node:path`). Use WHATWG `new URL()`; legacy `url.parse()` is forbidden.
- **Title Case Formatting:** Latin display names must standardize to Title Case on save boundaries using `applyTitleCaseRecursive` (`@mms/shared`). Exclude IDs, emails, dates, URLs, and non-Latin scripts (ar/ur/fa).
- **Banned Symbols:** Never use generic words (`data`, `info`, `helper`, `util`) as sole variable/file names. Ban legacy terms (`persona`/`Persona`) and temporary suffixes (`tmp`, `old`, `new`, `copy`).

## 3. Code Organization & Splitting Thresholds
- **Hard Cap 300 Lines:** No source file (`.ts`, `.tsx`, `.js`) may exceed **300 lines** (ratcheted by `pnpm run check:code-norms`; prefer ≤220 for new FE shells). Exceptions: translation dictionaries, `schema.ts`, test suites. Proactively split into dedicated sub-components, custom hooks, or utility modules before adding new features.
- **Preferred Decompositions:**
  - Page/panel logic: `use*PageController` / `use*Controller` (mutations, state, effects).
  - Action clusters: `use*Actions` / `*ActionHandlers` (save, bulk, restore handlers).
  - Presentational chunks: `*Section` / `*Panel` / `*Table` / `*Modal` (pure UI).
  - Pure transforms: `*Utils.ts` (promote to `@mms/shared` when used by >= 2 modules).
- **Layer Decoupling:** UI components handle presentation only. Move data fetching, side effects, and state orchestration to hooks/services.
- **Boundary Invariants:** Ban direct cross-feature imports between `tenant/features/*`. Route through facades (`@/tenant/hooks/collections/*`) or `@mms/shared`.
- **Stable Barrels:** Re-export from original entry points; use named exports everywhere (default exports only for lazy-loaded `{Module}Page.tsx`).

