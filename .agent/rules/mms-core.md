---
trigger: always_on
description: MMS core invariants, security, boundaries, and limits
---

# MMS Core Invariants

## 1. Critical Invariants
- **Protected Zones:** Never edit migrations, auth middleware, CI/CD, or root configs without explicit consent.
- **Tenant Isolation:** Enforce RLS (`SET LOCAL app.current_tenant`) + `can()`. Never trust client IDs.
- **Data Safety:** RFC 8785 JSON audit outbox; soft-delete (`WHERE deleted_at IS NULL`); forward-only DDL.

## 2. Boundaries & Limits
- **Layers:** `@mms/shared` = pure types/DTOs. `@shared/ui` = unified shared UI component primitives. TanStack Query server authority. Zero cross-feature imports.
- **Shared UI Governance:** Zero duplicate UI components across Tenant Console and Platform Console; all reusable components live in `@shared/ui`. Strict pre-deletion verification (`typecheck`, `lint`, `build`) required before cleaning up legacy UI files. Enforced by `pnpm run check:shared-ui` (CI ratchet) · rule `mms-shared-ui.md` · skill `mms-shared-ui` · workflow `/shared-ui-audit`.
- **Limits:** Strict TypeScript (zero `any`, no unsafe casts). 300 LOC hard cap per source file (ratcheted by `check:code-norms.mjs`).
- **Modern Web Baseline:** Modern evergreen browsers. Execute `modern-web-guidance` first on all HTML/CSS/DOM/clientside JS tasks; zero polyfills; Baseline features native behind feature detection (`AGENTS.md`).

## 3. Workflow Discipline
- **Plan-Task-Execute:** On every user request, ALWAYS plan before modifying code:
  1. *Plan First:* Inspect existing code/patterns, analyze requirements/constraints (tenant isolation, 300 LOC cap, strict TS, DRY reuse, `modern-web-guidance` standards), and design the solution.
  2. *Create Task List:* Emit an explicit, structured task checklist (`- [ ]`) decomposing the work into discrete, verifiable phases.
  3. *Execute & Verify Iteratively:* Execute step-by-step against the checklist, update progress (`- [x]`), apply surgical changes, and verify (typecheck/lint/test) after each step before declaring completion.
- **Execution:** Surgical diffs only. Zero filler prose. Never commit unless explicitly asked to commit; never push to remote under any circumstance unless explicitly instructed by the user. Always run full local CI (`pnpm ci:local`) and confirm 100% clean pass before committing.
