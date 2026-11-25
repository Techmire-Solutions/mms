---
name: mms-shared-ui
description: Governs @mms/ui SSOT (ban duplicates, migrate legacy, check orphaned imports). Use when shared UI primitives/audits. Do NOT use for backend (use mms-backend-api) or DDL (use mms-schema-migrate).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-11-16
allowed-tools: Read Grep Glob Write Edit Bash(node scripts/check-shared-ui.mjs) Bash(pnpm typecheck)
---

# MMS Shared UI Architecture & Component Governance

**Rules (norms SSOT):** `mms-dry.mdc` §1 (SSOT & duplicate ban), §4 (pre-deletion checks) · `mms-ui-ux-design.mdc` §1 (central primitives) · `mms-structure-naming.mdc` §1 (monorepo topology) · `mms-completion-review.mdc` §1 (verification gates).

## When to use

- Creating or standardizing reusable UI primitives shared across Tenant and Platform consoles.
- Migrating components from console-specific directories to `@mms/ui`.
- Auditing codebase for duplicate UI components or orphaned imports.
- Safely deleting legacy or deprecated UI components with pre-deletion verification.

## Architecture & Package Topology

The monorepo standardizes all domain-agnostic UI primitives in the `@mms/ui` package:

```
packages/ui/src/                    # @mms/ui (Single Source of Truth)
├── button/                         # Button, Badge
├── input/                          # Input, Select, Switch, Checkbox, Textarea, Slider, Label
├── card/                           # Card, CardHeader, CardTitle, CardContent, CardFooter, stripes
├── modal/                          # Modal, AlertDialog, dialog shells
├── table/                          # Table, DataTable, Pagination
├── dropdown-menu/                  # DropdownMenu, items, trigger, separators
├── popover/                        # Popover, PopoverContent, PopoverTrigger
├── tooltip/                        # Tooltip, TooltipContent, TooltipProvider
├── feedback/                       # Skeleton loading placeholders
├── data-display/                   # Avatar, initials
├── app/                            # console-agnostic composites (toolbars, panels, modals, pickers)
├── common/                         # shared directory/descriptor/table helpers
├── theme/                          # formStyles.ts, ThemeScope, UI config
└── utils.ts                        # cn (clsx + tailwind-merge)
```

### Exports & package boundary

- Every file under `packages/ui/src/**` must be reachable through a `package.json` `exports` entry. Use wildcard maps (`./app/*` → `./src/app/*.tsx`, `./common/*` → `./src/common/*.tsx`) plus explicit `*.ts` entries; a moved component with no export breaks every `@mms/ui/...` consumer with "Cannot find module".
- `@mms/ui` must never import `@mms/fe-core` (hooks/state) or any stateful package — the only acceptable non-UI import is `@mms/contracts` for **types**. Localization lives in `@mms/ui`'s own `useUiConfig()`/`labels`, never in `useTranslation()`.

### Consumption Rules

1. **Platform Console (`apps/platform-web/src/platform/`):**
   - Must import primitives directly from `@mms/ui`.
   - Never import from `@/components/ui/*`.
   - Never import from `@/tenant/*`.

2. **Tenant Console (`apps/tenant-web/src/tenant/`):**
   - Imports primitives either directly from `@mms/ui` or via `@/components/ui/*`.
   - Never import from `@/platform/*`.

3. **UI facades (retired):** the app-local `components/ui/` re-export shims were deleted in the
   monorepo migration; apps import `@mms/ui` directly. This check still flags any local primitive that
   duplicates a package implementation.
   - Provide backward-compatible, typed re-exports from `@mms/ui`.
   - Must contain zero local JSX component implementations or duplicate style logic.
   - Enforced by `.agent/skills/mms-shared-ui/scripts/check-shared-ui.mjs` (canonical implementation; `scripts/check-shared-ui.mjs` is a thin wrapper).

## Cross-Console Variation Principles

Never duplicate components across consoles to support visual or layout differences. Variations must be supported through:

1. **Prop-Based Variation:** Use clean, explicit props (e.g. `variant`, `tone`, `size`, `interactive`, `accentColor`).
2. **Composition:** Compose primitives into console-specific composites (e.g. `PlatformPageShell`, `PlatformAdminsToolbar`, `PersonDetailHeroCard`) while leaving primitives domain-agnostic.
3. **Theme & CSS Variables:** Rely on semantic CSS tokens mapped in `packages/ui/src/theme/formStyles.ts` and `index.css` rather than hardcoding colors.

## Strict Pre-Deletion & Cleanup Protocol

Whenever cleaning up legacy UI files, deprecated shims, or duplicate components:

1. **Pre-Deletion Gate:**
   ```bash
   pnpm typecheck
   pnpm --filter mms-tenant-web lint
   pnpm --filter mms-tenant-web build
   ```
   Ensure existing codebase builds and passes all checks before touching files.

2. **File Removal & Import Migration:**
   - Migrate consuming call sites to `@mms/ui`.
   - Remove the deprecated file or replace with a pure typed re-export.

3. **Post-Deletion Verification Gate:**
   ```bash
   pnpm typecheck
   pnpm --filter mms-tenant-web lint
   pnpm --filter mms-tenant-web build
   node scripts/check-shared-ui.mjs
   ```
   Confirm zero compilation errors, zero lint warnings, zero bundle errors, and zero orphaned imports.

## Verification

Run the automated governance checker:

```bash
# Canonical implementation (cited by this skill, the rule, and /shared-ui-audit):
node .agent/skills/mms-shared-ui/scripts/check-shared-ui.mjs
# The root script and the package script forward to the same implementation:
node scripts/check-shared-ui.mjs
pnpm run check:shared-ui
```

The implementation exists once, in the skill. The root wrapper exists so `pnpm run check:shared-ui`
and CI keep working without a second copy that can drift.

The script verifies:
- Platform Console imports 100% directly from `@mms/ui`.
- Zero cross-console leakage between Tenant and Platform consoles.
- No app-local primitive duplicates a `@mms/ui` implementation (the facade layer itself is gone).
- Zero duplicate UI primitive files across consoles.
- Zero orphaned imports referencing non-existent UI files.

## Related skills

`mms-frontend`, `mms-shared-package`, `mms-ui-ux-design`, `ui-ux-pro-max`, `mms-code-review`.

Related workflow: `/dry`.

Local script: [check-shared-ui.mjs](./scripts/check-shared-ui.mjs) (canonical implementation).
