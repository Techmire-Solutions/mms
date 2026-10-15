---
trigger: model_decision
description: Mandatory self-review checklist after code edits before marking tasks done
---

# MMS Completion Review

**Workflow skills:** checklist index → `mms-code-review` · a11y smoke → `mms-a11y-smoke` · UI design → `ui-ux-pro-max` · standards sync → `antigravity-workspace`.

Mandatory self-review before marking tasks done. Change boundary includes edited files and coupled dependents (DTO + consumer, schema + migration, rule + mirror). Never widen edits into unrelated refactors; never leave introduced defects.

## 1. Required Steps
1. **Re-Read Diff:** Verify logic errors, boundary assumptions, missing edge cases, and regressions.
2. **Fix In-Scope Defects:** Resolve all bugs introduced inside the change boundary before completion.
3. **Verify Applicable Scopes:**
   - TypeScript & Lint: Run `pnpm typecheck` on any non-trivial TS change, and `pnpm lint` (or app-scoped lint).
   - Code Norms & Architecture: Run `pnpm run check:code-norms` (zero explicit `any`, semantic tokens only, ≤300 LOC) and `pnpm run check:work-directory` (DataTable/WorkBatchTable reuse, viewMode SSOT) when modifying components or tables.
   - Shared UI & Pre-Deletion Verification: When modifying, moving, or cleaning up UI components or legacy files, execute the mandatory pre- and post-deletion gates in `mms-shared-ui.md` §4 (`typecheck`, `lint`, `build`, `check:shared-ui`) to prove zero duplicate primitives across consoles, zero orphaned imports, and pure facade delegation to `@shared/ui`.
   - Database & Projections: Run `pnpm run check:db-projections` (zero `SELECT *`) and `pnpm run check:migration-indexes` when touching DB schema, migrations, or queries.
   - Module Access Gates: Enforce authoritative tenant grant + module enablement + user action permission checks for module-owned routes/APIs (`moduleAccessCoverage.test.ts` & `routeAccess.test.ts`).
   - Tests: Run `pnpm test` (or scoped Vitest path). Auth/tenant/RLS/RBAC edits require backend `inject()` verification.
   - i18n: Add new `t()` keys to `appTranslationsEn.ts` first, then ar/ur/fa packs.
   - Responsive & UI/UX: Spot-check 375 / 768 / 1440; run responsive specs (`mms-ui-ux-design.md` §4) when AppLayout or primitives change. Align with `ui-ux-pro-max` (`mms-ui-ux-design.md` §8): semantic HSL tokens, BiDi classes, 44×44px touch floor.
   - Accessibility: Run axe smoke (`mms-ui-ux-design.md` §9, skill `mms-a11y-smoke`) on AppLayout, FormModal, and Table changes.
   - Standards Edits: Run `bash .agent/scripts/sync-all.sh && node scripts/verify-rules-integrity.mjs` on rule or skill edits.
   - Local CI Before Commit & Push: Run `pnpm ci:local` (path-aware gates + affected unit tests via `scripts/ci/local-ci.sh`). Agents must execute and confirm 100% green pass on the touched path buckets before creating any git commit or pushing to GitHub. Use `pnpm ci:local:full` for i18n/build/bundle parity; add `--with-db` / `--with-e2e` when those surfaces changed and services are up. Gates-only subset remains `bash .agent/skills/mms-code-review/scripts/pre-pr-review.sh` (invoked by `ci:local`). Do not set `SKIP_LOCAL_CI=1` unless the user explicitly asks.
4. **Diagnostics & Cleanup:** Remove unused imports, dead variables, and debug logging in changed files.

## 2. Fix Before Done
- Consult remedies in `references/fix-before-done.md` (skill `mms-code-review`).
- Fix all introduced issues inside the change boundary; explicitly name anything intentionally deferred.
- Skip verification only for question-only/review-only turns or trivial docs typos with no code impact.

## 3. Workflow Rules (Speed & Output Token Minimization)
- **Surgical Modifications:** Output targeted diffs or minimal replacement chunks only. Never rewrite entire files unless creating new files.
- **Zero Conversational Overhead:** Lead directly with code edits or verification results. Ban greetings, polite fillers, and restating user requests.
