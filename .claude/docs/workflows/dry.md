---
description: Audit codebase for DRY violations, refactor duplicate logic into shared abstractions (@mms/shared or local primitives), enforce single source of truth, date/currency formatting standards, and eliminate dead code.
---

# Workflow: Codebase DRY Audit

This workflow enforces the Single Source of Truth (SSOT) policy, eliminates duplicate code, centralizes domain logic, and ensures monorepo design system consistency.

## Phase 1: Context & Discovery

- [ ] **Load the owning rules**: Review `rules/mms-core.md`, `rules/mms-dry.md`, and `rules/mms-structure-naming.md`.
- [ ] **Search before writing**: Before creating new helpers or components, search the following paths for existing solutions:
  - `@mms/shared`
  - `apps/frontend/src/lib/`
  - `apps/frontend/src/components/ui/`
  - `apps/backend/src/`

## Phase 2: Pattern Identification

- [ ] **Identify extraction candidates**: Look for code that meets the extraction threshold:
  1. Logic or UI structure repeats $\ge 2$ times across files.
  2. Logic crosses feature module or frontend/backend boundaries.
  3. Implementation block is $> 15$ lines of identical or parametrically identical code.
- [ ] **Avoid premature abstraction**: Keep single-use code inlined.

## Phase 3: Extraction & Refactoring

- [ ] **Enforce layer boundaries**:
  - **`@mms/shared`**: Pure Zod schemas (`.strict()`), types, constants, DEFAULT_* configs, and I/O-free formatters. No React components, no direct DB queries, no browser APIs (`localStorage`, DOM).
  - **Imports**: Always use named exports from `@mms/shared` (e.g., `import { Contact } from '@mms/shared'`). Subpath imports are forbidden.
  - **Module Isolation**: Direct imports between frontend feature modules are strictly banned (e.g., importing `@/tenant/features/A` from `B`). Route shared data queries via `@/tenant/hooks/collections/*` facades or extract shared UI chrome to `components/ui` / `lib/`.
- [ ] **Utilize authoritative primitives**: Refactor code to use standard primitives rather than custom implementations:

| Category | Forbidden Anti-Pattern | Mandatory Authoritative Primitive / Helper |
| :--- | :--- | :--- |
| **Date Formatting** | `.toLocaleDateString()`, custom format strings | `formatDate` / `formatDateTime` (`@mms/shared`, `@/lib/utils`) |
| **Money / Currency** | `.toLocaleString()`, IEEE 754 floats, `PKR ` prefixes | Decimal strings + `formatMoney` (`@mms/shared`), `useFinanceCurrency` |
| **App Copy** | Hardcoded UI strings or labels | `t('key')` via `appTranslations` (`mms-settings-i18n.md`) |
| **Status Badges** | Inline status colors / raw maps | `StatusBadge` + semantic tokens (`mms-ui-ux-design.md`) |
| **Phones** | Split inputs / manual manipulation | Single phone input + `parsePhoneNumber` (`@mms/shared`, E.164) |
| **Initials** | Manual string split/slice | `getInitials` (`@mms/shared`) |
| **Form Controls** | Raw HTML `<select>`, `<textarea>`, `<input>`, checkbox | Primitives: `FormSelect`, `Textarea`, `Input`, `SearchBar`, `Checkbox` |
| **Detail Drawers** | Custom slide-over wrappers | `<DetailDrawerShell>` central primitive component |
| **Metrics / Cards** | Duplicated metric card layouts | `StatCard`, `ModuleCommandMetricsGrid` |
| **Toolbars & Export**| Duplicated export UI | `ExportToolbar` primitive |
| **Charts** | Bare Recharts container wrappers | `SafeResponsiveContainer` primitive |

- [ ] **Enforce strict validation**: Validate client payloads with zero-trust strict Zod schemas and Fastify requests with typed JSON schemas.

## Phase 4: Verification & Cleanup

- [ ] **Remove dead code**: Delete unused imports, variables, unreferenced code, and debug logs within the change boundary.
- [ ] **Run static analysis**:
  ```bash
  pnpm typecheck
  cd apps/frontend && pnpm lint
  cd apps/backend && pnpm lint
  ```
- [ ] **Sync Standards**: If any standards files or skills were modified during this audit, run:
  ```bash
  bash .agent/scripts/sync-all.sh
  ```

---

> [!CAUTION]
> **Strict Typing & Security**
> Never use `any`, `@ts-ignore`, or `@ts-nocheck`. Use `unknown` with type narrowing. Never log tokens, passwords, or PII.
