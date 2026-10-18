# ADR-001: 300-Line Code Ceiling and Proactive Modular Decomposition

- **Status:** Accepted & Enforced
- **Date:** 2026-09-24 (ceiling revised from 200 to 300 to match the `check:code-norms.mjs` ratchet)
- **Context:** Large monolithic source files decrease readability, complicate git diffs, impair testability, and increase cognitive load.
- **Decision:**
  1. A strict hard cap of 300 lines of code (LOC) is established for all source files (`.ts`, `.tsx`, `.js`), machine-enforced by `pnpm run check:code-norms`.
  2. When any file approaches or exceeds 300 LOC, developers and agentic workflows must proactively decompose logic into dedicated sub-components, custom hooks, use-case interactors, or pure utility services before adding new features. New frontend shells should aim for ≤220 LOC.
  3. Stable barrel exports must be maintained so external consumers do not churn.
  4. Exceptions are strictly limited to unified translation dictionaries (`appTranslations*.ts`), `schema.ts`, and large integration test suites.
- **Consequences:** Highly modular codebase, clear ownership of responsibilities, clean git history with minimal surgical diffs.

---
