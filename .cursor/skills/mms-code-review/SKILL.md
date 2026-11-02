---
name: mms-code-review
description: Reviews a concrete change set (PR or local diff) against MMS rules before merge — severity triage, rule citations, and a merge/no-merge verdict. Use when a specific diff must be accepted or rejected before merge. Do NOT use for finding and fixing a security weakness (use mms-backend-security), for authoring a new module (use mms-module-page), or for running the browser test suites (use mms-testing-e2e).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-11-02
allowed-tools: Read Grep Glob Bash(pnpm typecheck) Bash(pnpm lint) Bash(pnpm test) Bash(pnpm ci:local) Bash(pnpm ci:local:full) Bash(bash scripts/ci/local-ci.sh) Bash(bash .agent/skills/mms-code-review/scripts/pre-pr-review.sh)
---

# MMS Code Review

**Rule (norms SSOT):** `mms-completion-review.mdc` · `mms-tdd.mdc` (Red evidence) · `mms-core.mdc` · `mms-structure-naming.mdc` · `mms-performance.mdc`.

## When to use

- A concrete PR or local diff must be accepted or rejected before merge
- Running the pre-PR gate suite before human review

Agent self-review after edits → also follow always-on `mms-completion-review.mdc`.

**When X → skill Y (deep dive, not this index):** FormModal / Zod forms → **`mms-form-architecture`** · Query factories → **`mms-query-factories`** · axe / focus-return → **`mms-a11y-smoke`** · UI/UX design intelligence → **`ui-ux-pro-max`** · deps bumps → **`mms-dependency-upgrade`** · DDL → **`mms-schema-migrate`** · CSRF/cookies → **`mms-backend-security`** · backup wipe → **`mms-backup-restore`** · Soft-delete → **`mms-soft-delete`**.

The full pre-merge checklist (12 subsections, per-surface items) is a lookup, not a narrative: **`references/checklist.md`**. Work it top-to-bottom for the surfaces the diff actually touches — shared/lib, hooks/Query, forms, Work tier, setup, backend, DB/RLS, security, i18n/a11y, tests, performance, rules/mirrors.

## Accounting change review

For financial changes, use [accounting verification](../mms-finance-accounting/references/verification.md) and its case-level evidence rather than treating a green typecheck or balanced totals as sufficient. Advisory focus: all write paths, changed-payload retries, close/post races, classification/cutoff, and report consumers including independent dashboard KPIs.

Separate demonstrated controls from capability gaps and framework-dependent policy. Independent ledger review is called for by the existing completion-review reference; do not claim a statutory audit or universal compliance from a code review.

## Modern practices (pointers only)

| When reviewing… | Owner |
|-----------------|--------|
| Keyset/cursor vs OFFSET lists | `mms-data-layer.mdc` · **`mms-backend-api`** / **`mms-query-factories`** |
| Contested PUT / `updated_at` → 409 | `mms-api-interface.mdc` §6 · **`mms-backend-api`** |
| `sql.raw` / statement_timeout | `mms-data-layer.mdc` · **`mms-schema-migrate`** / **`mms-backend-api`** |
| Dense table virtualization | `@tanstack/react-virtual` — `mms-ui-ux-design.mdc` · **`mms-module-work`** · `mms-performance.mdc` |
| List pending a11y (`aria-busy`) | `mms-ui-ux-design.mdc` · **`mms-a11y-smoke`** |
| Query `placeholderData: (prev) => prev` | `mms-data-layer.mdc` · **`mms-query-factories`** |
| Zero queries in loops (N+1) | `mms-performance.mdc` · **`mms-backend-api`** |
| Zero wildcard projections (`SELECT *`) | `mms-performance.mdc` · **`mms-data-layer.mdc`** |
| Redis multi-tier caching & invalidation | `mms-performance.mdc` · **`mms-backend-api`** |
| Performance savings documentation | `mms-performance.mdc` · **`mms-code-review`** |
| bodyLimit / outbound `AbortSignal.timeout` / idempotency↔body | `mms-api-interface.mdc` · **`mms-backend-api`** |
| Title Case skip ar/ur/fa / RTL prose | `mms-structure-naming.mdc` · **`mms-shared-package`** |
| Messaging send idempotency digest | `mms-api-interface.mdc` §6 · **`mms-messaging`** |
| Audit trail 5 dimensions & RFC 8785 canonical JSON | `mms-data-layer.mdc` §5 · `mms-auth-security.mdc` §5 · **`mms-audit-trail`** |
| Sharded hash chains & Merkle rollups | `mms-performance.mdc` §1 · **`mms-audit-trail`** |
| Crypto-shredding & right-to-erasure | `mms-auth-security.mdc` §5 · **`mms-audit-trail`** |
| Monthly date partition detachment & WORM cold tier | `mms-ops-infrastructure.mdc` §5 · `mms-data-layer.mdc` §5 · **`mms-audit-trail`** |
| Auditing the Auditor & compliance exports | `mms-reports.mdc` §9 · **`mms-audit-trail`** |
| INSERT-only audit privileges & pgAudit pairing | `mms-auth-security.mdc` §5 · **`mms-audit-trail`** |
| Soft-delete invariants & 3-tier index strategy | `mms-data-layer.mdc` §6 · `mms-module-architecture.mdc` §6 · **`mms-soft-delete`** |
| Uniqueness-on-restore 23505 trap & partial unique indexes | `mms-data-layer.mdc` §6 · `mms-backend-api` · **`mms-soft-delete`** |
| Session revocation on user soft-delete | `mms-auth-security.mdc` · `mms-backend-security` · **`mms-soft-delete`** |
| Scheduled retention hard-purge worker (LIMIT 500 SKIP LOCKED) | `mms-data-layer.mdc` §6 · `mms-background-jobs` · **`mms-soft-delete`** |
| Active foreign key guarding on writes | `mms-data-layer.mdc` §6 · `mms-form-architecture` · **`mms-soft-delete`** |
| Outbox CDC tombstones with monotonic versioning | `mms-data-layer.mdc` §6 · **`mms-soft-delete`** |
| UI/UX Pro Max design intelligence & tokens | `mms-ui-ux-design.mdc` §8 · **`ui-ux-pro-max`** |
| Module access gates & coverage checks | `mms-auth-security.mdc` §3 · **`mms-backend-api`** / **`mms-frontend`** |
| Code norms (zero `any`, semantic tokens, 300 LOC) | `mms-dry.mdc` §4 · `mms-ui-ux-design.mdc` §2 · `mms-structure-naming.mdc` §3 |
| Work directory convergence (DataTable SSOT) | `mms-dry.mdc` §1 · `mms-module-architecture.mdc` §3 · **`mms-module-work`** |
| Template persistence, CAS/409 and print SSOT | `mms-document-templates.mdc` · **`mms-document-templates`** |

## Evidence rules

- **Reproduce on production's path.** A defect is real only when it reproduces through what production runs: the repository mapper's output, the contract's request validation, the actual guard. A neighbouring shape (raw SQL projection, a mock, a static reading) makes a *hypothesis*, not a finding — label it and verify before assigning severity.
- **"Untested" is not "broken".** Missing coverage is a test gap; report it as such (and add the spec). Do not inflate it into a defect.
- **Reachable denial codes only.** A `required: true` module (`dashboard`, `contacts`, …) can never return `MODULE_DISABLED`/`MODULE_NOT_GRANTED` — a test that expects it is itself the bug. Check `globalSettingsModuleRegistry.ts` before writing the assertion.
- **Specs that pin a bug are part of the fix.** When a fix changes documented behaviour, the spec asserting the old behaviour must be rewritten with the new intent, and the PR body must name the changed assertion.
- **Close findings with fix + test + status.** Every finding maps to a pinning test on production's path and a status entry (closed/partial/deferred). Keep the original findings as the point-in-time record and add a status table; name residuals for partial/deferred items. A skipped/self-skipping browser spec is untested evidence and cannot close a finding.

## Review order

1. Automated gates (`pnpm ci:local`: pre-pr gates + path-aware FE/BE/shared unit tests)
2. Security, tenant isolation & module access gates (`authenticateTenant`, `registerModuleAccess`, `TENANT_APP_ROUTE_ACCESS`, RBAC)
3. Data layer (Query vs legacy, bulk upsert, RLS, zero wildcard projections, soft-delete)
4. Contract parity (write DTO accepts the read mapper's shape), server-owned fields, OCC 409 path
5. Module §7 gold-standard (+ messaging variants when touched)
6. UI design tokens & i18n / a11y (semantic HSL tokens, 44×44px touch floor, axe smoke via `mms-a11y-smoke`)
7. Document templates (server row vs legacy store, CAS/409 keeps draft, one renderer/print path, localized field catalogs)
8. Batch writers (one config load, one broadcast/invalidation, batched outbox, per-row audit)
9. Derived projections & read-only fields (reconciled on every lifecycle/batch path, archive semantics, workspace-local dates, per-entity lock, write stripping)
10. Cross-module reads (lean DTO + owner viewer sanitizer; no full owner read shape)
11. Upload/media lifecycle (tenant paths, owning-action gate, URL whitelist, reference-checked unlink, sweep dry-run)
12. Derived caches (TTL, config invalidation, write-version guard, post-save recheck)
13. Scope creep & dead code removal

## Automated checks

```bash
pnpm ci:local
# broader parity: pnpm ci:local:full
# opt-in heavy: bash scripts/ci/local-ci.sh --full --with-db --with-e2e
```

Module access verification (when touching routing, navigation, or endpoints):
```bash
pnpm --filter mms-backend test src/__tests__/moduleAccessCoverage.test.ts
pnpm --filter mms-frontend test src/lib/config/routeAccess.test.ts
```

E2E when touching auth/routing/onboard: `pnpm test:e2e` (critical path: `e2e/tests/platform-onboarding.spec.ts`)

## Severity

- **Critical:** security bypass, missing `authenticateTenant`, cross-tenant leak, bulk wipe PUT, data loss, breaking audit hash chains
- **Major:** missing RBAC on writes, missing module access gate, raw `fetch('/api')`, dual data paths, broken migration journal, nested `ContactConfigProvider`
- **Minor:** style, optional DRY, residual `role ===` in untouched files

## References

- Pre-merge checklist: `references/checklist.md`
- Fix-before-done checklist: `references/fix-before-done.md`
- Adversarial loophole audit deliverable template: `references/adversarial-audit-template.md`

## Scripts

Prefer **`pnpm ci:local`** (`scripts/ci/local-ci.sh`) before push/PR: it runs `pre-pr-review.sh` then path-aware unit tests (mirrors `ci.yml` change filters). By default it is affected-only (turbo `--affected` typecheck, changed-file lint, `vitest --changed`); `--full` runs every suite. `.githooks/pre-push` invokes it automatically after blocking direct pushes to `main`; `.githooks/pre-commit` only checks secrets and lints staged files.

Gates-only (no tests):

```bash
bash .agent/skills/mms-code-review/scripts/pre-pr-review.sh
```

`pre-pr-review.sh` runs the standards verifier, migration-index and DB-projection ratchets, code-norms and work-directory ratchets, `pnpm typecheck`, and `pnpm lint`. Default `ci:local` skips DB/e2e/gitleaks/shard coverage merge — use `--with-db` / `--with-e2e` / `ci:local:full` when needed. CI still scans full git history for secrets.

- Rules: `mms-api-interface.mdc`, `mms-data-layer.mdc`, `mms-hooks.mdc`, `mms-ui-ux-design.mdc`, `mms-auth-security.mdc`, `mms-form-architecture.mdc`, `mms-messaging.mdc`, `mms-migration-status.mdc`, `mms-performance.mdc`

## Related skills

`mms-frontend`, `mms-backend-api`, `mms-backend-security`, `mms-soft-delete`, `mms-audit-trail`, `mms-form-architecture`, `mms-query-factories`, `mms-schema-migrate`, `mms-backup-restore`, `mms-a11y-smoke`, `mms-dependency-upgrade`, `mms-messaging`, `ui-ux-pro-max`.
