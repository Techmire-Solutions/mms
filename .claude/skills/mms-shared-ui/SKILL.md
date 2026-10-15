---
name: mms-shared-ui
description: Governs the shared component architecture (@shared/ui / packages/ui) between Tenant Console and Platform Console — enforces single source of truth for UI primitives, bans cross-console duplicate components, validates pre-deletion cleanup safety, and catches orphaned imports. Use when creating, modifying, moving, auditing, or refactoring UI primitives across Tenant and Platform consoles, or checking for orphaned/duplicate components. Do NOT use for backend API routes (use mms-backend-api), database schema migrations (use mms-schema-migrate), or design token/style intelligence (use ui-ux-pro-max).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-15
allowed-tools: Read Grep Glob Write Edit Bash(node scripts/check-shared-ui.mjs) Bash(pnpm typecheck)
---

# MMS Shared UI Architecture & Component Governance

**Rules (norms SSOT):** `mms-dry.md` §1 (SSOT & duplicate ban), §4 (pre-deletion checks) · `mms-ui-ux-design.md` §1 (central primitives) · `mms-structure-naming.md` §1 (monorepo topology) · `mms-completion-review.md` §1 (verification gates).

## When to use

- Creating or standardizing reusable UI primitives shared across Tenant and Platform consoles.
- Migrating components from console-specific directories to `@shared/ui`.
- Auditing codebase for duplicate UI components or orphaned imports.
- Safely deleting legacy or deprecated UI components with pre-deletion verification.

## Architecture & Package Topology

The monorepo standardizes all domain-agnostic UI primitives in the `@shared/ui` package:

```
packages/ui/src/                    # @shared/ui (Single Source of Truth)
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
├── theme/                          # formStyles.ts, ThemeScope, UI config
└── utils.ts                        # cn (clsx + tailwind-merge)
```

### Consumption Rules

1. **Platform Console (`apps/frontend/src/platform/`):**
   - Must import primitives directly from `@shared/ui`.
   - Never import from `@/components/ui/*`.
   - Never import from `@/tenant/*`.

2. **Tenant Console (`apps/frontend/src/tenant/`):**
   - Imports primitives either directly from `@shared/ui` or via `@/components/ui/*`.
   - Never import from `@/platform/*`.

3. **UI Facades (`apps/frontend/src/components/ui/`):**
   - Provide backward-compatible, typed re-exports from `@shared/ui`.
   - Must contain zero local JSX component implementations or duplicate style logic.
   - Enforced by `scripts/check-shared-ui.mjs`.

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
   pnpm --filter mms-frontend lint
   pnpm --filter mms-frontend build
   ```
   Ensure existing codebase builds and passes all checks before touching files.

2. **File Removal & Import Migration:**
   - Migrate consuming call sites to `@shared/ui`.
   - Remove the deprecated file or replace with a pure typed re-export.

3. **Post-Deletion Verification Gate:**
   ```bash
   pnpm typecheck
   pnpm --filter mms-frontend lint
   pnpm --filter mms-frontend build
   node scripts/check-shared-ui.mjs
   ```
   Confirm zero compilation errors, zero lint warnings, zero bundle errors, and zero orphaned imports.

## Verification

Run the automated governance checker:

```bash
node .agent/skills/mms-shared-ui/scripts/check-shared-ui.mjs
# or via the root script / npm script:
node scripts/check-shared-ui.mjs
pnpm run check:shared-ui
```

The script verifies:
- Platform Console imports 100% directly from `@shared/ui`.
- Zero cross-console leakage between Tenant and Platform consoles.
- UI facades in `components/ui/` contain zero duplicate JSX implementations.
- Zero duplicate UI primitive files across consoles.
- Zero orphaned imports referencing non-existent UI files.

## Related skills

`mms-frontend`, `mms-shared-package`, `mms-ui-ux-design`, `ui-ux-pro-max`, `mms-code-review`.

Related workflow: `/dry`.

Local script: [check-shared-ui.mjs](file:///Users/syedaalin/Documents/mms/.agent/skills/mms-shared-ui/scripts/check-shared-ui.mjs).
