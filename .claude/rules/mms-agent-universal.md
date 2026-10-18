---
description: Universal agent cognition, planning, DRY reuse, communication economy, and banned operations
---

# MMS Agent Universal Standards

**Workflow skills:** orientation / sync → `antigravity-workspace` · PR review → `mms-code-review` · UI design → `ui-ux-pro-max`. Ownership matrix → `.cursor/rules/README.md`.

## 1. Cognition & Behaviour
- **Plan-First Protocol:** For every request, systematically execute the three-phase lifecycle:
  1. *Discovery & Plan:* Read and understand intent, search relevant codebase locations, inspect existing patterns/abstractions (`@mms/shared`, hooks, UI primitives), and evaluate constraints (tenant RLS, strict TS, 300 LOC cap). For UI, query `ui-ux-pro-max` (`mms-ui-ux-design.md` §8).
  2. *Actionable Task List:* Formulate an explicit, structured task checklist (`- [ ]`) breaking the implementation into discrete, sequenced phases (e.g., Types/Schemas → Backend/API → Frontend/Hooks → Components → Verification).
  3. *Iterative Execution & Verification:* Execute task-by-task against the checklist. Mark tasks in-flight (`- [/]`) and completed (`- [x]`). Run targeted verifications (typecheck, lint, or tests) after each phase before proceeding.
- **Reuse First (DRY):** Search existing utilities and components (`@mms/shared`, `@shared/ui`, `@/components/app`, `@/components/common`, `@/hooks`) before writing new code. Keep shared behaviour configurable; verify consumers (`mms-dry.md` §1–§2).
- **Targeted Focus:** Edit in-scope files only. Terse, functional, idiomatic code without boilerplate or narrating comments.
- **Surgical Edits:** Emit targeted patches with minimal context; never rewrite whole files unless creating new files.
- **Rendering Hygiene:** Memoize non-trivial operations and callbacks passed to memoized children; avoid premature memoization (`mms-performance.md`).

## 2. Communication & Output Economy
- **Prose & Code:** Clear, structured prose explaining non-obvious trade-offs. Lead directly with code; zero conversational greetings, fillers, or prompt echoes.
- **Artifacts & Logs:** Provide direct file links with 1-line context; never echo artifact contents in chat. Limit tool inspection and shell output (`git log -n 5`, `head -n 50`, `--silent`).
- **Tests & JSDoc:** Unit test `@mms/shared` pure helpers (`mms-testing-observability.md`). JSDoc on public exports in `packages/shared` only; omit elsewhere.

## 3. Security, State & Standards
- **Zero-Trust DTOs:** Validate via `@mms/shared` Zod + Fastify `parseRequest` (`mms-api-interface.md`, `mms-core.md`). Unidirectional state flow (`mms-data-layer.md` §4).
- **Concurrency & Signals:** Pass `AbortSignal` into `apiFetch` and `queryFn`; combine via `AbortSignal.any()`. Clear timers and observers.
- **TypeScript:** Strict mode. Use `unknown` + narrowing (never `any`, never `as unknown as T`). Native immutability: `toSorted()`, `toReversed()`, `toSpliced()`, `Object.groupBy()`. Zero `enum` or `namespace`.
- **Node.js 24:** Native built-ins (`node:` imports, `new URL()`, `using` / `await using`) (`mms-dependencies.md`).
- **A11y & UI:** Semantic HTML5, Tailwind utilities, landmarks (`<main>`, `<nav>`, `<header>`), 44×44px touch floor (`mms-ui-ux-design.md` §2, §8).
- **Git Boundaries:** Conventional Commits. Protected `main`. NEVER run `git add`, `commit`, or `push` unless explicitly told "commit". Never push to GitHub under any circumstance unless explicitly instructed by the user. Always run full local CI (`pnpm ci:local`) and ensure 100% clean pass before committing.
- **Shell Commands:** Explicit working directory or single-shot `cd <dir> && <cmd>`. Never leave shell in un-reset directory.
- **Enforcement:** Norms are machine-enforced (lint, ratchet, test, hook) or explicitly labelled advisory.

## 4. Anti-Patterns & Banned Operations
- ❌ **Protected Zones:** Never modify DB migrations, auth middleware/services, CI/CD, Dockerfiles, or root configs without explicit authorization.
- ❌ **File Size:** Never exceed 300 lines in source files (`.ts`, `.tsx`, `.js`) (exceptions: translation dictionaries, `schema.ts`, test suites; see `mms-structure-naming.md` §3). Decompose into sub-components, hooks, or services.
- ❌ **Decoupling:** Never couple presentation with data orchestration. UI components render state only; fetching/state logic belongs in hooks/services.
- ❌ **Validation Bypass:** Never bypass validation with type casting (`as unknown as T`, `any`, untyped dictionaries).
- ❌ **File Deletion:** Never delete files without explicit confirmation.
- ❌ **New Dependencies:** Never invent new dependencies; check Node 24 built-ins, `@mms/shared`, and `pnpm-workspace.yaml` first.
- ❌ **Premature Execution / Code Guessing:** Never jump straight into code modifications without first discovering codebase context, forming a plan, and establishing an actionable task checklist.
- ❌ **Norm Restatement:** Never restate an owned norm; link to owning rule in `.cursor/rules/README.md`.
