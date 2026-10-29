---
name: mms-code-review
description: Reviews a concrete change set (PR or local diff) against MMS rules before merge — severity triage, rule citations, and a merge/no-merge verdict. Use when a specific diff must be accepted or rejected before merge. Do NOT use for finding and fixing a security weakness (use mms-backend-security), for authoring a new module (use mms-module-page), or for running the browser test suites (use mms-testing-e2e).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-29
allowed-tools: Read Grep Glob Bash(pnpm typecheck) Bash(pnpm lint) Bash(pnpm test) Bash(pnpm ci:local) Bash(pnpm ci:local:full) Bash(bash scripts/ci/local-ci.sh) Bash(bash .agent/skills/mms-code-review/scripts/pre-pr-review.sh)
---

# MMS Code Review

**Rule (norms SSOT):** `mms-completion-review.md` · `mms-tdd.md` (Red evidence) · `mms-core.md` · `mms-structure-naming.md` · `mms-performance.md`.

## When to use

- A concrete PR or local diff must be accepted or rejected before merge
- Running the pre-PR gate suite before human review

Agent self-review after edits → also follow always-on `mms-completion-review.md`.

**When X → skill Y (deep dive, not this index):** FormModal / Zod forms → **`mms-form-architecture`** · Query factories → **`mms-query-factories`** · axe / focus-return → **`mms-a11y-smoke`** · UI/UX design intelligence → **`ui-ux-pro-max`** · deps bumps → **`mms-dependency-upgrade`** · DDL → **`mms-schema-migrate`** · CSRF/cookies → **`mms-backend-security`** · backup wipe → **`mms-backup-restore`** · Soft-delete → **`mms-soft-delete`**.

The full pre-merge checklist (12 subsections, per-surface items) is a lookup, not a narrative: **`references/checklist.md`**. Work it top-to-bottom for the surfaces the diff actually touches — shared/lib, hooks/Query, forms, Work tier, setup, backend, DB/RLS, security, i18n/a11y, tests, performance, rules/mirrors.

## Accounting change review

For financial changes, use [accounting verification](../mms-finance-accounting/references/verification.md) and its case-level evidence rather than treating a green typecheck or balanced totals as sufficient. Advisory focus: all write paths, changed-payload retries, close/post races, classification/cutoff, and report consumers including independent dashboard KPIs.

Separate demonstrated controls from capability gaps and framework-dependent policy. Independent ledger review is called for by the existing completion-review reference; do not claim a statutory audit or universal compliance from a code review.

## Modern practices (pointers only)

| When reviewing… | Owner |
|-----------------|--------|
| Keyset/cursor vs OFFSET lists | `mms-data-layer.md` · **`mms-backend-api`** / **`mms-query-factories`** |
| Contested PUT / `updated_at` → 409 | `mms-api-interface.md` §6 · **`mms-backend-api`** |
| `sql.raw` / statement_timeout | `mms-data-layer.md` · **`mms-schema-migrate`** / **`mms-backend-api`** |
| Dense table virtualization | `@tanstack/react-virtual` — `mms-ui-ux-design.md` · **`mms-module-work`** · `mms-performance.md` |
| List pending a11y (`aria-busy`) | `mms-ui-ux-design.md` · **`mms-a11y-smoke`** |
| Query `placeholderData: (prev) => prev` | `mms-data-layer.md` · **`mms-query-factories`** |
| Zero queries in loops (N+1) | `mms-performance.md` · **`mms-backend-api`** |
| Zero wildcard projections (`SELECT *`) | `mms-performance.md` · **`mms-data-layer.md`** |
| Redis multi-tier caching & invalidation | `mms-performance.md` · **`mms-backend-api`** |
| Performance savings documentation | `mms-performance.md` · **`mms-code-review`** |
| bodyLimit / outbound `AbortSignal.timeout` / idempotency↔body | `mms-api-interface.md` · **`mms-backend-api`** |
| Title Case skip ar/ur/fa / RTL prose | `mms-structure-naming.md` · **`mms-shared-package`** |
| Messaging send idempotency digest | `mms-api-interface.md` §6 · **`mms-messaging`** |
| Audit trail 5 dimensions & RFC 8785 canonical JSON | `mms-data-layer.md` §5 · `mms-auth-security.md` §5 · **`mms-audit-trail`** |
| Sharded hash chains & Merkle rollups | `mms-performance.md` §1 · **`mms-audit-trail`** |
| Crypto-shredding & right-to-erasure | `mms-auth-security.md` §5 · **`mms-audit-trail`** |
| Monthly date partition detachment & WORM cold tier | `mms-ops-infrastructure.md` §5 · `mms-data-layer.md` §5 · **`mms-audit-trail`** |
| Auditing the Auditor & compliance exports | `mms-reports.md` §9 · **`mms-audit-trail`** |
| INSERT-only audit privileges & pgAudit pairing | `mms-auth-security.md` §5 · **`mms-audit-trail`** |
| Soft-delete invariants & 3-tier index strategy | `mms-data-layer.md` §6 · `mms-module-architecture.md` §6 · **`mms-soft-delete`** |
| Uniqueness-on-restore 23505 trap & partial unique indexes | `mms-data-layer.md` §6 · `mms-backend-api` · **`mms-soft-delete`** |
| Session revocation on user soft-delete | `mms-auth-security.md` · `mms-backend-security` · **`mms-soft-delete`** |
| Scheduled retention hard-purge worker (LIMIT 500 SKIP LOCKED) | `mms-data-layer.md` §6 · `mms-background-jobs` · **`mms-soft-delete`** |
| Active foreign key guarding on writes | `mms-data-layer.md` §6 · `mms-form-architecture` · **`mms-soft-delete`** |
| Outbox CDC tombstones with monotonic versioning | `mms-data-layer.md` §6 · **`mms-soft-delete`** |
| UI/UX Pro Max design intelligence & tokens | `mms-ui-ux-design.md` §8 · **`ui-ux-pro-max`** |
| Module access gates & coverage checks | `mms-auth-security.md` §3 · **`mms-backend-api`** / **`mms-frontend`** |
| Code norms (zero `any`, semantic tokens, 300 LOC) | `mms-dry.md` §4 · `mms-ui-ux-design.md` §2 · `mms-structure-naming.md` §3 |
| Work directory convergence (DataTable SSOT) | `mms-dry.md` §1 · `mms-module-architecture.md` §3 · **`mms-module-work`** |

## Review order

1. Automated gates (`pnpm ci:local`: pre-pr gates + path-aware FE/BE/shared unit tests)
2. Security, tenant isolation & module access gates (`authenticateTenant`, `registerModuleAccess`, `TENANT_APP_ROUTE_ACCESS`, RBAC)
3. Data layer (Query vs legacy, bulk upsert, RLS, zero wildcard projections, soft-delete)
4. Module §7 gold-standard (+ messaging variants when touched)
5. UI design tokens & i18n / a11y (semantic HSL tokens, 44×44px touch floor, axe smoke via `mms-a11y-smoke`)
6. Scope creep & dead code removal

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

- Rules: `mms-api-interface.md`, `mms-data-layer.md`, `mms-hooks.md`, `mms-ui-ux-design.md`, `mms-auth-security.md`, `mms-form-architecture.md`, `mms-messaging.md`, `mms-migration-status.md`, `mms-performance.md`

## Related skills

`mms-frontend`, `mms-backend-api`, `mms-backend-security`, `mms-soft-delete`, `mms-audit-trail`, `mms-form-architecture`, `mms-query-factories`, `mms-schema-migrate`, `mms-backup-restore`, `mms-a11y-smoke`, `mms-dependency-upgrade`, `mms-messaging`, `ui-ux-pro-max`.
