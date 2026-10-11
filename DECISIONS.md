# Architecture Decision Records (ADRs) — MMS Monorepo

This document records the architectural standards, conventions, and design decisions governing the Madrasa Management System (MMS) monorepo.

---

## ADR-001: 300-Line Code Ceiling and Proactive Modular Decomposition

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

## ADR-002: Strict Layer Decoupling (Presentation vs State Orchestration)

- **Status:** Accepted & Enforced
- **Date:** 2026-09-24
- **Context:** Coupling React JSX presentation with data fetching, server cache invalidation, business rule derivations, and side effects leads to brittle components and untestable UI.
- **Decision:**
  1. UI components must exclusively handle presentation and render state.
  2. All data fetching, caching, state orchestration, side effects, and calculations must be extracted into dedicated custom hooks, services, or repository adapters.
  3. Presentation sub-components receive clean, serializable props and emit event callbacks.
- **Consequences:** UI components can be tested in isolation using mock props; business logic can be tested without mounting full DOM trees.

---

## ADR-003: Strict Type Safety & Runtime Zod Contracts at Boundaries

- **Status:** Accepted & Enforced
- **Date:** 2026-09-24
- **Context:** TypeScript types are erased at runtime. Relying solely on compile-time types or `any`/untyped dictionaries creates security holes, deserialization bugs, and runtime crashes.
- **Decision:**
  1. Zero tolerance for `any`, untyped object literals/dictionaries, and `unknown` without explicit narrowing type guards.
  2. Double assertions (`as unknown as T`) to bypass validation are forbidden.
  3. All API boundaries, external payloads, and database persistence operations must be validated against runtime Zod schemas defined in `@mms/shared` (using `.strict()` for write DTOs).
- **Consequences:** Total type safety at compile time and runtime integrity at system boundaries.

---

## ADR-004: Protected Infrastructure Zones and Authorization Guardrails

- **Status:** Accepted & Enforced
- **Date:** 2026-09-24
- **Context:** Automated agents or inadvertent modifications to critical infrastructure (migrations, authentication, CI/CD, build tools) can destabilize the entire platform.
- **Decision:**
  1. The following core infrastructure zones are declared Protected Zones and must NOT be modified without explicit, logged user authorization:
     - Database migrations (`apps/backend/src/db/migrations_drizzle/`, `migrations/`)
     - Authentication middleware and session infrastructure (`apps/backend/src/middleware/authenticate*.ts`, `apps/backend/src/services/auth/`)
     - CI/CD pipelines, Dockerfiles, and deployment configs (`.github/workflows/`, `Dockerfile*`)
     - Global build configs (`tsconfig.json`, `tailwind.config.js`, `vite.config.ts`)
  2. Dependency additions are forbidden without prior review; existing workspace catalog dependencies must be inspected first.
- **Consequences:** Protected core systems remain immutable against unintended agentic regressions.

---

## ADR-005: Living Documentation Synchronization and Tri-Mirror Rule Topology

- **Status:** Accepted & Enforced
- **Date:** 2026-09-24
- **Context:** Development teams and AI coding assistants operate across Cursor, Claude Code, and Antigravity. Rule drift causes conflicting agent behaviors.
- **Decision:**
  1. Single source of truth (SSOT) for rules is `.cursor/rules/*.mdc`.
  2. SSOT for skills is `.agent/skills/*/SKILL.md`.
  3. Automated synchronization via `bash .agent/scripts/sync-all.sh` mirrors rules to `.agent/rules/` and `.claude/rules/`, and skills to `.cursor/skills/` and `.claude/skills/`.
  4. CI and pre-commit gates enforce zero drift via `node scripts/verify-rules-integrity.mjs`.
  5. Architectural evolution must be documented immediately in `DECISIONS.md` and `SYSTEM_ARCHITECTURE.md`.
- **Consequences:** Complete agent alignment across all tools and synchronized living documentation.

---

## ADR-006: Semantic Design Tokens and Design System Enforcements

- **Status:** Accepted & Enforced
- **Date:** 2026-09-24
- **Context:** Hardcoded hex color codes and arbitrary pixel spacing produce inconsistent themes, break dark mode, and degrade accessibility.
- **Decision:**
  1. All UI components must consume semantic design tokens defined in Tailwind CSS v4 and `index.css` `@theme` (`primary`, `secondary`, `destructive`, `success`, `muted`, `accent`, `card`, `popover`).
  2. Raw hex colors outside `@theme` are forbidden and ratcheted via `scripts/check-code-norms.mjs`.
  3. All layouts must use BiDi logical properties (`ms-`, `me-`, `start-`, `end-`) to guarantee bidirectional RTL/LTR support for Arabic and Urdu.
- **Consequences:** Cohesive visual identity, dynamic tenant brand theming, accessible contrast ratios, and flawless BiDi rendering.

---

## ADR-007: Mandatory Automated Verification Gates

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

## ADR-008: Prepared Statements Modularization & Database Query Strict Typing

- **Status:** Accepted & Enforced
- **Date:** 2026-09-24
- **Context:** `apps/backend/src/db/preparedStatements.ts` had grown to 329 LOC with duplicated SQL prepare boilerplate and loose `any` typing across query builders, statement holders, and client arguments.
- **Decision:**
  1. Decomposed column selections into `apps/backend/src/db/preparedColumns.ts` (102 LOC) to separate projection metadata from statement execution mechanics.
  2. Preserved public column exports in `preparedStatements.ts` as a stable barrel facade to prevent breaking changes in repository consumers.
  3. Eliminated all `any` annotations using strongly typed `PreparedLookupStatement<TRow>` matching table `$inferSelect` types.
  4. Implemented DRY `getOrCompileStatement` helper, reducing `preparedStatements.ts` from 329 LOC down to 166 LOC (well within the 300 LOC ceiling).
  5. Eliminated `any` annotations in `dbClient.ts` soft-delete relational guardrails via typed relational callback interfaces.
  6. Ratcheted down repository-wide `any` baseline from 64 to 51 and files over ceiling from 79 to 78.
- **Consequences:** Strictly typed database read path, zero regressions in hot-path queries, reduced cognitive overhead, and machine-enforced compliance with the 300 LOC hard ceiling.

---

## ADR-009: Prettier Owns Formatting (enforced)

- **Status:** Accepted & Enforced
- **Date:** 2026-10-11
- **Context:** `.prettierrc.json` and `.prettierignore` were committed but Prettier was never installed, so formatting was unenforced and the editor hook (`.cursor/hooks/format-edited-file.sh`) silently no-opped.
- **Decision:**
  1. `prettier` and `eslint-config-prettier` are root devDependencies; `pnpm format` (write) and `pnpm format:check` (verify) are root scripts.
  2. `eslint-config-prettier/flat` is registered last in every `eslint.config.js` (frontend, backend, `@mms/shared`, e2e) so ESLint owns no stylistic rules.
  3. `.prettierignore` excludes agent/scratch trees (`.agent/`, `.cursor/`, `.claude/`, `.commandcode/`, `.superpowers/`, `docs/`) so the tri-mirror rule/skill corpus stays byte-identical for `verify-rules-integrity.mjs`, and the unified translation dictionaries (`packages/shared/src/appTranslations*.ts`, the ADR-001 exemption) which a line-based i18n parity checker (`scripts/i18n/check-translations.ts`) parses one `"key": "value"` per line.
  4. `pnpm format:check` gates the `typecheck-lint` CI job.
  5. **ADR-004 authorization recorded:** this change adds root dependencies and edits `.github/workflows/ci.yml` (both Protected Zones); explicit authorization was granted by the project owner for the remediation program of 2026-10-11.
- **Consequences:** Consistent formatting repo-wide, machine-enforced in CI; the one-time reformat landed as an isolated commit.
