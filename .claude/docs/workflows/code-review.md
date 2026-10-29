---
description: Review MMS changes against project rules and migration status
---

# Workflow: Code Review

This workflow guides the systematic review of codebase changes (e.g., Pull Requests or local diffs) to ensure strict adherence to MMS project standards and prevent technical debt regression.

## Phase 1: Context & Rule Loading

- [ ] **Load review skill**: Invoke the `mms-code-review` skill to prepare for the review process.
- [ ] **Load the core rules**: Review the core guidelines by reading `rules/mms-core.md`, `rules/mms-completion-review.md`, `rules/mms-agent-universal.md`, and `rules/mms-migration-status.md`.
- [ ] **Load scoped rules**: Identify the domain of the changes and load relevant scoped rules (e.g., `rules/mms-dry.md`, `rules/mms-dependencies.md`, `rules/mms-auth-security.md`, `rules/mms-data-layer.md`, `rules/mms-ui-ux-design.md`).

## Phase 2: Automated Checks

- [ ] **Run automated quality gates**: Execute the unified MMS pre-PR verification script to validate rules, ratchets, type safety, and linting:
  ```bash
  bash .agent/skills/mms-code-review/scripts/pre-pr-review.sh
  ```
  Or run targeted ratchets independently:
  ```bash
  node scripts/verify-rules-integrity.mjs
  pnpm run check:migration-indexes
  pnpm run check:db-projections
  pnpm run check:code-norms
  pnpm run check:work-directory
  pnpm typecheck
  pnpm lint
  ```
- [ ] **Run tests**: If applicable, run `pnpm test` for the affected packages or apps. Verify backend tests include `inject()` allow+deny authorization checks.
- [ ] **Verify module access coverage**: When touching routes, navigation, or module endpoints, run:
  ```bash
  pnpm --filter mms-backend test src/__tests__/moduleAccessCoverage.test.ts
  pnpm --filter mms-frontend test src/lib/config/routeAccess.test.ts
  ```

## Phase 3: Diff Analysis & Project Alignment

Audit the diff against the core MMS invariants:

- [ ] **Backend / Data Layer (`mms-backend-api`, `mms-schema-migrate`, `mms-performance`)**:
  - DDL is forward-only with `FORCE RLS` on new tenant tables.
  - Endpoints enforce `authenticateTenant` / `authenticatePlatform`.
  - Every module-owned route registers module access (`registerModuleAccess` + `MODULE_ROUTE_ACTION_RULES`).
  - Zero wildcard projections (`SELECT *`), verified via `check:db-projections.mjs`.
  - Zero queries in loops (N+1); batch with Drizzle relational `with` or `inArray`.
  - Transaction RLS (`SET LOCAL app.current_tenant`) is used appropriately for tenant writes.
  - Zero-trust DTOs validated via `@mms/shared` Zod strict schemas before persistence.
- [ ] **Frontend Architecture (`mms-frontend`, `mms-query-factories`, `mms-module-work`)**:
  - TanStack Query v5 is used for data fetching (no new `useLiveCollection` for REST entities).
  - Every module route is gated via `TENANT_APP_ROUTE_ACCESS` + `ModuleAccessRoute`.
  - Work directory uses the shared `DataTable` / `WorkBatchTable` stack (zero hand-rolled tables, verified via `check:work-directory.mjs`).
  - Cross-feature imports are banned (e.g. importing `@/tenant/features/A` from `B`). Shared logic must reside in `@mms/shared` or `@/tenant/hooks/collections/*` facades.
  - Code splits properly at the ~300-line soft ceiling via stable barrels (`mms-structure-naming.md`).
- [ ] **UI & i18n Parity (`mms-ui-ux-design.md`, `mms-settings-i18n.md`, `ui-ux-pro-max`)**:
  - Design tokens: zero raw hex colours outside `@theme`, zero Tailwind bracket expressions (`[#...]`), verified via `check:code-norms.mjs`.
  - Semantic HTML (`<main>`, `<nav>`, `<section>`), minimum 44x44px touch targets, BiDi logical classes (`ps-*`, `pe-*`, `start-*`, `end-*`).
  - UI/UX Pro Max design intelligence alignment (`mms-ui-ux-design.md` §8): semantic HSL color mapping, resilient text layout (`text-wrap: balance`), compact labels/inputs, micro-interaction state preservation.
  - No hardcoded English strings. All text uses `t()` with keys in `appTranslationsEn.ts` (and ar/ur/fa packs).
  - `ErrorState` implementations include descriptive hints (e.g., `loadFailedHint`), not just titles.
- [ ] **Data Standards & DRY (`mms-dry.md`)**:
  - Money is handled as decimal strings (no IEEE 754 floats).
  - Phone numbers use E.164 via `parsePhoneNumber`.
- [ ] **Node.js 24 Runtime & Modern Practices (`mms-dependencies.md`, `mms-structure-naming.md`, `mms-ops-infrastructure.md`)**:
  - Core module imports use mandatory `node:` protocol prefix (`node:fs/promises`, `node:crypto`, `node:path`, `node:async_hooks`).
  - No banned dependencies introduced (`dotenv`, `axios`, `node-fetch`, `ws` for client communication, `glob`, `fast-glob`, `path-to-regexp`).
  - Native built-ins used: `--env-file`/`process.loadEnvFile()`, global `fetch()`, `FormData`, `WebSocket`, `crypto.hash()`, `URLPattern`, and WHATWG `new URL()` (never `url.parse()`).
  - Scoped resource disposal leverages `using` / `await using` (Explicit Resource Management).
  - Context & trace propagation uses `AsyncLocalStorage`; logs emit structured JSON to stdout (Pino).
  - Test suites use Vitest (`vitest run`); CLI/scripts leverage `--experimental-strip-types`.
- [ ] **Strict TDD & Adversarial Loophole Audit (`mms-tdd.md` §1–§2, `mms-testing-observability.md` §12, `mms-completion-review.md` §4)**:
  - Strict TDD verified: automated Vitest spec written first, with the Red-phase command + failure recorded in the PR body (Red before Green).
  - Multi-tenant integration & RLS isolation: live DB tests verify cross-tenant isolation (Tenant A cannot access/mutate/delete Tenant B records) and atomic transaction rollbacks.
  - Deliverable verified: PR or completion output contains the 3-part Adversarial Loophole Audit markdown deliverable (Identified Vulnerabilities, Mitigations & Safeguards, Resilience Justification).
- [ ] **Debt Regressions**: Check against `rules/mms-migration-status.md` to ensure "Recently Resolved" items (like raw `role ===` checks) are not reintroduced.

## Phase 4: Report Generation

Format your review output clearly, categorizing findings by severity. Do not output the entire file content; point to specific lines or files.

### Finding Classifications

- **Critical** — Blockers that must be fixed before merge (e.g., build failures, bypassed RLS, type errors).
- **Major** — Significant rule violations that spread debt or architectural flaws (e.g., missing translation keys, cross-feature imports, missing Zod validation).
- **Minor** — Style nits, optional DRY extractions, or minor optimizations.

---

> [!IMPORTANT]
> **Zero-Regression Policy**
> If the review uncovers newly introduced violations of existing standards, flag them as **Major** or **Critical**. Do not let technical debt accumulate in new feature work.
