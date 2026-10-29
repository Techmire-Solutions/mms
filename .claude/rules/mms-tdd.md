---
description: Test-first delivery — Red/Green/Refactor for backend domain layers, shared helpers, and bug fixes
paths:
  - "apps/backend/src/**/use-cases/**/*.ts"
  - "apps/backend/src/**/services/**/*.ts"
  - "apps/backend/src/**/repositories/**/*.ts"
  - "apps/backend/src/**/repository/**/*.ts"
  - "packages/shared/src/**/*.ts"
  - "apps/frontend/src/tenant/features/**/hooks/**/*.ts"
---

# MMS Test-Driven Delivery

**Workflow skills:** testing workflows → `mms-testing-e2e` · PR/self-review → `mms-code-review` · auth/RLS specs → `mms-backend-security`.

Applies to business logic, use-case handlers, services, repositories, `@mms/shared` pure helpers, tenant hooks, and every bug fix. UI component specs follow `mms-testing-observability.md` §2–§4.

## 1. Red → Green → Refactor
1. **Red:** write the failing Vitest spec first (`*.test.ts` / `*.test.tsx`, colocated or under `apps/backend/src/__tests__/`) that states the expected behaviour.
2. **Verify the failure:** run `pnpm --filter <workspace> test <path-to-test>` and record the command plus the exact failing assertion or stack in the PR body (`## Test plan`). Syntax or import failures are not a valid Red.
3. **Green:** implement only what turns the assertion green; no speculative scope.
4. **Refactor:** clean up without changing test assertions.

## 2. Enforcement & Evidence
- **Advisory (review discipline):** no gate can prove test-first ordering. `pnpm run check:tdd-pairing` (run by `pre-pr-review.sh`) warns when a changed backend domain file has no changed test in the same module, and `.github/pull_request_template.md` requires the Red evidence.
- **Regression tests are mandatory:** every bug fix lands with a spec that failed before the fix and passes after it, kept permanently.
- **Scope:** a spec that only asserts a mock was called is not a Red — assert observable behaviour (`mms-testing-observability.md` §4).
