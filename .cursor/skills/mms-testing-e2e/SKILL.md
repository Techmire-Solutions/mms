---
name: mms-testing-e2e
description: Automated testing guide for MMS — Vitest unit/integration tests, Fastify inject() API tests, Playwright E2E specs, responsive/RTL smoke suites, and axe-core accessibility checks. Use when writing, running, or debugging frontend, backend, shared package, or end-to-end tests. Do NOT use for static TypeScript typechecks (use pnpm typecheck) or dependency auditing (use mms-dependency-upgrade).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-29
compatibility: Requires Node 24+, Playwright browsers (pnpm --filter e2e-tests exec playwright install), and a live PostgreSQL for test:db.
allowed-tools: Read Grep Glob Bash(pnpm test) Bash(pnpm test:e2e) Bash(pnpm --filter *)
---

# MMS Testing & E2E Workflow

**Rules (norms SSOT):** `mms-tdd.mdc` (Red → Green → Refactor) · `mms-testing-observability.mdc` · `mms-completion-review.mdc` · `mms-ui-ux-design.mdc` §3–§4. Accessibility smoke → `mms-a11y-smoke`.

## When to use

- Writing or debugging Vitest, Fastify `inject()`, or Playwright suites
- Running responsive/RTL or axe smoke gates for a UI change

## 1. Monorepo Testing Tiers & Commands

- **Shared Pure Helpers**: `pnpm --filter @mms/shared test` (Vitest unit tests for schemas, formatters, pure utils).
- **Backend API & RBAC**: `pnpm --filter mms-backend test` (Fastify `inject()` + `vi.hoisted()` in-memory repository mocks).
- **Database Integration**: `pnpm --filter mms-backend test:db` (Real PostgreSQL suite for RLS, transaction locks, and SQL aggregates).
- **Frontend Components & Hooks**: `pnpm --filter mms-frontend test` (Vitest + happy-dom for TanStack Query facades, modals, and forms).
- **Playwright E2E**: `pnpm test:e2e` (Playwright project root is `e2e/`). For execution commands and directory layout, see [references/playwright-test-guide.md](references/playwright-test-guide.md).
- **Responsive & A11y Smoke**: Specs live at `e2e/tests/responsive/responsive-shell.spec.ts` and `e2e/tests/a11y/a11y-shell.spec.ts`; run via `pnpm test:e2e tests/responsive/responsive-shell.spec.ts` and `pnpm test:e2e tests/a11y/a11y-shell.spec.ts`. Auth bootstrap: `e2e/helpers/tenantBootstrap.ts`.

## 2. Testing Quality Invariants

- **Test-First (Red → Green → Refactor)**: write the failing spec before the production change and record the exact failure in the PR body (`mms-tdd.mdc` §1–§2); a bug fix without a regression spec does not ship.
- **Zero Skip Latches**: Never write conditional test skips (`if (!isDbAvailable) return;`). Tests must fail explicitly when required infrastructure is missing (`mms-testing-observability.mdc` §1).
- **Specification Naming & AAA**: Structure tests with specification titles (`describe('Entity', () => it('given [X], should [Y] when [Z]'))`) and explicit `// Arrange`, `// Act`, `// Assert` blocks (`mms-testing-observability.mdc` §2).
- **User-Centric Locators & Black Box**: Query via accessible roles and labels (`getByRole`, `getByLabelText`, `getByText`); never assert on internal state or class names (`mms-testing-observability.mdc` §3).
- **Transport Mocking & Typed Factories**: Use Fastify `inject()` or transport interceptors; replace static JSON fixtures with typed factories (`mms-testing-observability.mdc` §4).
- **Assertion Specificity**: Strict equality and type checks only. Loose `toBeTruthy()` or `toBeDefined()` on primitives or DOM elements are banned.
- **Clean Stdout**: Spy on `console.error`/`console.warn` during expected error simulations. Test configs set `LOG_LEVEL = 'silent'`.
- **Query Client Isolation**: Frontend tests wrap components in an isolated `new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })`.
- **Coverage Ratchet**: never lower the `thresholds` configured in each workspace's `vitest.config.ts` (the only SSOT; `mms-testing-observability.mdc` §5); raise a floor only with a measured value from a green run.

## 3. Playwright E2E Best Practices

- **User-Centric Locators**: Use accessible locators (`page.getByRole()`, `page.getByLabel()`, `page.getByPlaceholder()`). Brittle XPath and deep CSS selectors (`div > span > input`) are banned.
- **Auto-Retrying Assertions**: Use `expect(locator).toBeVisible()` and `expect(locator).toBeEnabled()`. Ban hardcoded `page.waitForTimeout()`.
- **Auth Context Fixtures**: Reuse authenticated storage states (`e2e/helpers/tenantBootstrap.ts`) instead of submitting login forms in each spec.
- **RTL Mirroring**: Verify Arabic/Urdu (`dir="rtl"`) renders with zero page horizontal overflow (`document.documentElement.scrollWidth <= window.innerWidth`).

## Verification

- Unit/integration: `pnpm --filter @mms/shared test`, `pnpm --filter mms-backend test`, `pnpm --filter mms-frontend test` — all suites green, no skipped files.
- DB/RLS evidence: `pnpm --filter mms-backend test:db` (real PostgreSQL) or `pnpm ci:local --with-db` when schema/migrations/queries changed.
- Browser: `pnpm test:e2e` (or a single spec path); a11y smoke must report zero serious/critical axe violations.
- Red evidence: `pnpm run check:tdd-pairing` shows no unpaired backend domain file, and the PR body records the failing command + assertion.

## Examples

- Fastify inject: `examples/fastify-inject.test.ts`
- Playwright smoke: `examples/playwright-smoke.spec.ts`
- Tenant RLS concurrency: `examples/tenant-rls-concurrency.test.ts`

## Related skills

`mms-a11y-smoke`, `mms-dev-setup`, `mms-code-review`.
