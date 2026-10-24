# ADR-007: Mandatory Automated Verification Gates

- **Status:** Accepted & Enforced
- **Date:** 2026-09-24
- **Context:** Code changes without rigorous automated verification introduce silent regressions in tenant isolation, calculation logic, and UI behavior.
- **Decision:**
  1. Every non-trivial change requires passing verification before being marked complete:
     - Static type safety: `pnpm typecheck`
     - Automated test suites: `vitest run` (frontend, backend, shared)
     - Code norms ratchet: `node scripts/check-code-norms.mjs`
     - Standards integrity: `node scripts/verify-rules-integrity.mjs`
  2. No task may be marked done with failing tests or unaddressed defects.
- **Consequences:** Zero-regression guarantee across all workspaces and packages.

---
