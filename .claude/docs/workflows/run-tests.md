---
description: Run all unit, integration, typecheck, lint, and E2E tests across MMS, diagnose failures, and iteratively fix all defects until 100% clean pass state.
---

# Workflow: Run Tests & Resolve Diagnostics

This workflow provides a comprehensive, systematic procedure for executing test suites, type checking, and linting across the MMS monorepo (`apps/frontend`, `apps/backend`, `packages/contracts`), diagnosing any failures, and applying root-cause fixes until all checks pass cleanly.

## Phase 1: Environment & Context Gathering

- [ ] **Load core skills**: Review `mms-testing-e2e` for execution diagnosis, `mms-completion-review.md` for post-edit verification, and `mms-testing-observability.md` for testing standards.
- [ ] **Review Verification Matrix**: Identify the necessary commands for your scope:

| Scope | Command | Description |
|---|---|---|
| **Monorepo Typecheck** | `pnpm typecheck` | Strict TS check across `@mms/contracts`, `mms-backend`, `mms-frontend`, `e2e-tests` |
| **Full Unit/Integration** | `pnpm test` | Vitest execution across `@mms/contracts`, `apps/backend`, and `apps/frontend` |
| **Monorepo Lint** | `pnpm lint` | Complete ESLint check across all packages (`@mms/contracts`, `mms-frontend`, `mms-backend`) |
| **Isolated Test** | `pnpm --filter <pkg> test <file>` | Rapid Vitest run on a specific file (`@mms/contracts`, `mms-backend`, `mms-frontend`) |
| **E2E Playwright** | `pnpm --filter e2e-tests test` | Full browser integration via Playwright + axe-core a11y checks |
| **All-in-One** | `pnpm typecheck && pnpm test && pnpm lint` | Complete single-command monorepo validation pass |

## Phase 2: Ordered Test Suite Execution

- [ ] **Run Type Checking**: Ensure structural correctness first.
  ```bash
  pnpm typecheck
  ```
- [ ] **Run Unit & Integration Tests**: Verify logic across the monorepo via Vitest.
  ```bash
  pnpm test
  ```
- [ ] **Run Lint Diagnostics**: Check style, boundaries, and React/Fastify rules across all packages.
  ```bash
  pnpm lint
  ```
- [ ] **Run E2E & A11y (Optional but Recommended)**: Run browser user journey tests + axe-core accessibility checks.
  ```bash
  pnpm test:e2e
  ```

> [!IMPORTANT]
> If any command fails, inspect the complete error stack trace immediately before making any code modifications.

## Phase 3: Root Cause Diagnosis & Quality Invariants

For any failed test or diagnostic error, follow these steps sequentially:

- [ ] **Read log output in full**: Inspect exact failure traces, file paths, line numbers, and expected vs. actual values.
- [ ] **Categorize failures against Project Rules**:
  - **Type Errors (`TSxxxx`)**: Schema mismatches, missing properties, un-narrowed `unknown`. Check `@mms/contracts` Zod exports.
  - **Assertion Failures**: Broken logic, invalid normalization. Verify backend tests include `inject()` allow/deny checks.
  - **Mock/Fixture Errors**: Outdated fixtures missing schema fields, missing RBAC context, unhandled async promises. Replace static `.json` fixtures with typed factories (`mms-testing-observability.md` §4).
  - **Lint & Boundaries**: Direct cross-feature imports (banned by `mms-dry.md`), missing `t()` keys, unused variables.
- [ ] **Enforce strict invariants**: Address the root cause in the source logic or update test fixtures to match current `@mms/contracts` Zod schemas.

> [!CAUTION]
> **Zero-Tolerance Anti-Patterns**
> ❌ **NEVER** comment out failing assertions, delete tests, or add skip latches (`if (!isDbAvailable) return;`) to fake a pass (`mms-testing-observability.md` §1).
> ❌ **NEVER** use weak assertions (`toBeTruthy()`, `toBeFalsy()`, or generic `toBeDefined()`) when exact values, formats (e.g. ISO regex), or DOM element types (`toBeInstanceOf(HTMLButtonElement)`) can be asserted (`mms-testing-observability.md` §1).
> ❌ **NEVER** assert on component internal state, private functions, or CSS classes; query through accessible roles (`getByRole`), labels (`getByLabelText`), and visible text (`mms-testing-observability.md` §3).
> ❌ **NEVER** use static mutable `.json` fixtures for domain models; use typed factory builders (`mms-testing-observability.md` §4).
> ❌ **NEVER** use arbitrary `sleep()` or `waitForTimeout()` delays; use deterministic async awaiters (`findBy*`, `waitFor`) (`mms-testing-observability.md` §4).
> ❌ **NEVER** write vanity tests without actionable behavioral assertions purely to execute code paths and boost percentages (`mms-testing-observability.md` §5).
> ❌ **NEVER** lower repository or package coverage percentages below baseline (The Ratchet Rule, `mms-testing-observability.md` §5).
> ❌ **NEVER** add `@ts-ignore`, `@ts-nocheck`, or cast to `any` to bypass type errors.
> ❌ **NEVER** swallow errors in empty `catch` blocks or return dummy fallback values.
> ❌ **NEVER** leave unmocked `console.error` / `console.warn` log pollution in expected negative test scenarios.

## Phase 4: Targeted Iterative Fix & Re-test

- [ ] **Isolate & Patch**: Apply targeted fixes to the source file or test definition.
- [ ] **Run fast isolated tests**: Provide rapid feedback loop on the specific file:
  ```bash
  pnpm --filter @mms/contracts test <filename>.test.ts
  pnpm --filter mms-backend test <filename>.test.ts
  pnpm --filter mms-frontend test <filename>.test.tsx
  ```
- [ ] **Verify adjacent scope**: Ensure the patch did not introduce regressions in shared utilities (`packages/contracts`), hooks, or database queries.

## Phase 5: Final Clean Pass Verification

- [ ] **Execute full validation**: Re-run the entire suite to guarantee zero regressions across the monorepo.
  ```bash
  pnpm typecheck && pnpm test && pnpm lint
  ```

## Phase 6: Reporting & Summary

- [ ] **Summarize execution results**: Output a clear report in your final message:
  - **Typecheck**: ✅ Passed / ❌ Failed
  - **Unit/Integration Tests**: ✅ Passed (X passed, 0 failed, 0 skipped) / ❌ Failed
  - **Monorepo Linting**: ✅ Clean / ❌ Issues remaining
  - **Summary of Root-Cause Fixes**: Concise log of root causes identified and targeted patches applied.
