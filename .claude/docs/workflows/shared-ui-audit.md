---
description: Audit frontend codebase for shared UI component compliance, eliminate cross-console duplicate components, check for orphaned imports, and enforce pre-deletion validation.
---

# Workflow: Shared UI Component Architecture & Governance Audit

This workflow establishes and audits the Single Source of Truth (SSOT) policy for UI components across the Tenant Console (`apps/tenant-web/src/`) and Platform Console (`apps/platform-web/src/`).

## Phase 1: Context & Discovery

- [ ] **Load the owning rules**: Review `rules/mms-core.md`, `rules/mms-dry.md`, `rules/mms-ui-ux-design.md`, and `rules/mms-structure-naming.md`.
- [ ] **Inspect SSOT shared package**: Audit `packages/ui/src/` (`@mms/ui`) before authoring any new component.
- [ ] **Check import patterns**: Verify consuming consoles:
  - Platform Console must import directly from `@mms/ui`.
  - Tenant Console imports from `@mms/ui` or backward-compatible `@/components/ui/*` facades.
  - Zero cross-console imports between `tenant/` and `platform/`.

## Phase 2: Automated Governance Verification

- [ ] **Run shared UI governance check**:
  ```bash
  node scripts/check-shared-ui.mjs
  # or via npm script:
  pnpm run check:shared-ui
  ```
- [ ] **Check frontend structural ratchets**:
  ```bash
  pnpm run check:frontend-structure
  ```
- [ ] **Triage any reported violations**:
  1. *Duplicate primitives*: Move local definitions into `@mms/ui`.
  2. *Cross-console imports*: Decouple domain logic or promote shared presentation to `@mms/ui`.
  3. *Non-conforming Platform imports*: Update `@/components/ui/*` to `@mms/ui`.
  4. *Orphaned imports*: Remove or repoint unresolvable import specifiers.

## Phase 3: Extraction & Standardization in `@mms/ui`

- [ ] **Standardize in `packages/ui`**:
  - Keep components domain-agnostic (zero tenant/platform business logic).
  - Support cross-console variations via explicit props (`variant`, `tone`, `size`, `interactive`) or subcomponent composition.
  - Export from `packages/ui/src/index.ts`.
- [ ] **Maintain facade purity in `apps/tenant-web/src/components/ui/`**:
  - Primitives must only re-export from `@mms/ui`.
  - Zero local JSX component declarations in facade files.

## Phase 4: Strict Pre-Deletion & Cleanup Protocol

Whenever deleting deprecated shims, duplicate component files, or dead code:

- [ ] **Step 1: Pre-deletion verification gate**:
  ```bash
  pnpm typecheck
  pnpm --filter mms-tenant-web lint
  pnpm --filter mms-tenant-web build
  ```
  Ensure the project builds cleanly before deleting files.
- [ ] **Step 2: Safe deletion**:
  - Remove deprecated/duplicate file.
  - Update all consuming call sites to `@mms/ui`.
- [ ] **Step 3: Post-deletion verification gate**:
  ```bash
  pnpm typecheck
  pnpm --filter mms-tenant-web lint
  pnpm --filter mms-tenant-web build
  pnpm run check:shared-ui
  ```
  Confirm zero orphaned imports or broken build targets remain.

## Phase 5: Verification & Sync

- [ ] **Run full verification suite**:
  ```bash
  pnpm typecheck
  pnpm run check:shared-ui
  pnpm run check:frontend-structure
  pnpm run check:code-norms
  pnpm --filter mms-tenant-web test
  ```
- [ ] **Sync Standards**: If rules or skills were modified during the audit, run:
  ```bash
  bash .agent/scripts/sync-all.sh
  node scripts/verify-rules-integrity.mjs
  ```

---

> [!CAUTION]
> **Zero Duplicate Primitives**
> Never author parallel buttons, inputs, modals, cards, or overlays in `platform/` or `tenant/`. Always promote reusable UI controls to `@mms/ui`.
