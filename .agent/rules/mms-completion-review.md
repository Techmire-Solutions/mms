---
trigger: always_on
description: Mandatory self-review checklist after code edits before marking tasks done
---

# MMS Completion Review

**Workflow skills:** checklist index → `mms-code-review` · a11y smoke → `mms-a11y-smoke` · UI design → `ui-ux-pro-max` · standards sync → `antigravity-workspace`.

Mandatory self-review before marking tasks done. Change boundary includes edited files and coupled dependents (DTO + consumer, schema + migration, rule + mirror). Never widen edits into unrelated refactors; never leave introduced defects.

## 1. Required Steps
1. **Re-Read Diff:** Verify logic errors, boundary assumptions, missing edge cases, and regressions.
2. **Fix In-Scope Defects:** Resolve all bugs introduced inside the change boundary before completion.
3. **Verify Applicable Scopes:**
   - TypeScript & Lint: Run `pnpm typecheck` on any non-trivial TS change, `pnpm lint` (or app-scoped lint), and `pnpm format:check` (Prettier code style).
   - Code Norms & Architecture: Run `pnpm run check:code-norms` (zero explicit `any`, semantic tokens only, ≤300 LOC), `pnpm run check:frontend-structure`, and `pnpm run check:work-directory` (DataTable/WorkBatchTable reuse, viewMode SSOT) when modifying components or tables.
   - Shared UI & Pre-Deletion Verification: execute the pre- and post-deletion gates in `mms-shared-ui.md` §4 when modifying, moving, or cleaning up UI components or legacy files.
   - Database & Projections: Run `pnpm run check:db-projections` (zero `SELECT *`), `pnpm run check:migration-indexes`, and `pnpm run check:migration-hygiene` when touching DB schema, migrations, or queries.
   - Module Access Gates: Enforce authoritative tenant grant + module enablement + user action permission checks for module-owned routes/APIs (`moduleAccessCoverage.test.ts` & `routeAccess.test.ts`).
   - Tests & TDD: Run `pnpm test` (or scoped Vitest path). Auth/tenant/RLS/RBAC edits require backend `inject()` verification. Backend domain changes carry Red-phase evidence in the PR body (`mms-tdd.md` §2); `pnpm run check:tdd-pairing` warns when a changed domain file has no changed spec.
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

## 4. Adversarial Loophole Audit (Post-Completion Review)
Once all unit and integration tests pass, pause prior to declaring completion and perform a structured adversarial review covering:
- **Edge Cases & Payload Integrity:** Malformed nested objects, unexpected unicode characters, timezone offsets (UTC normalization), SQL/NoSQL edge values, and duplicate submission idempotency (e.g., double form submits, webhook retries).
- **Failure Modes & Silent Failures:** Check for unhandled Promise rejections, swallowed `try/catch` blocks without logging, missing timeouts on network calls, and hanging database transactions.
- **Security, Authorization & Multi-Tenancy:** Authentication token validation, session revocation checks, fine-grained RBAC permission checks, Direct Object Reference (IDOR) vulnerabilities, tenant leakages in logging, and unmasked sensitive settings/passwords.
- **Concurrency & Resource Management:** Race conditions on status updates (e.g., concurrent balance adjustments, inventory allocations), leaked connection pools, unclosed file handles, hanging BullMQ job locks, or unbounded memory arrays.

**Mandatory Audit Deliverable:** Produce a markdown audit report before final submission (template: `.agent/skills/mms-code-review/references/adversarial-audit-template.md`; the PR template carries the same three sections) containing:
1. **Identified Vulnerabilities/Loopholes:** Specific risks evaluated during the self-review.
2. **Mitigations & Fixes:** Concrete automated tests and code safeguards added to address them.
3. **Resilience Justification:** Explicit architectural evidence demonstrating why remaining edge cases are safely handled.
