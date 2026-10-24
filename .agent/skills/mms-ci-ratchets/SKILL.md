---
name: mms-ci-ratchets
description: Diagnoses and resolves failures in MMS custom CI ratchets and pre-commit checks — check:backend-boundaries, check:code-norms, check:db-projections, check:work-directory, and verify-rules-integrity. Use when a local or CI ratchet script fails or when verifying pre-PR compliance. Do NOT use for running unit/E2E test suites (use mms-testing-e2e) or setting up dev environment packages (use mms-dev-setup).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS CI Ratchets & Quality Gates

**Rules (norms SSOT):** `mms-completion-review.md` (mandatory self-review) · `mms-agent-universal.md` §1 (enforcement principle) · `mms-core.md` §3 (workflow discipline).

## When to use

- A pre-commit, pre-push, or CI script fails on a `check:*` ratchet
- Verifying boundary rules before creating a PR or pushing changes
- Investigating code-norm violations, 300 LOC limits, or architecture leaks

## 1. The Core Ratchet Registry

All rules in MMS are either machine-enforced or explicitly labelled advisory (`mms-agent-universal.md`). The custom ratchets in `scripts/` ensure architecture cannot silently degrade:

| Command | Script Path | What It Enforces | Remediation Recipe |
|---|---|---|---|
| `pnpm run check:backend-boundaries` | `scripts/check-backend-boundaries.mjs` | Routes cannot directly import DB repositories or `drizzle-orm` | Route handlers must call domain use-cases / services |
| `pnpm run check:code-norms` | `scripts/check-code-norms.mjs` | 300-line hard file limit, zero `any`, raw hex colors | Split files into focused components, use `@theme` CSS tokens |
| `pnpm run check:db-projections` | `scripts/check-db-projections.mjs` | Prohibits unconstrained `select()` wildcard projections | Explicitly select required column sets in SQL/Drizzle queries |
| `pnpm run check:work-directory` | `scripts/check-work-directory.mjs` | 6 Work directory invariants (no CSS dual render, `DataTable` SSOT) | Use `DataTable` / `WorkBatchTable` and `DirectoryCard` composites |
| `pnpm run check:shared-ui` | `scripts/check-shared-ui.mjs` | Zero duplicate UI primitives across Tenant & Platform | Import primitives from `@shared/ui`; eliminate console forks |
| `pnpm run check:shared-purity` | `.agent/skills/mms-shared-package/scripts/check-shared-exports.sh` | Pure TypeScript only in `@mms/shared` (no DOM/Node/React) | Move UI/runtime logic to consuming app packages |
| `pnpm run check:faculty-domain` | `scripts/check-faculty-domain.mjs` | Prohibits retired legacy terms (`/api/teachers`, `FDA`) | Use `facultyDesignations`, `facultyAssignments`, `facultyDepartments` |
| `pnpm run check:migrations-forward-only` | `scripts/check-migrations-forward-only.mjs` | Applied migrations are immutable | Only append new sequential forward DDL migrations |

## 2. Hard Anti-Patterns (Banned Operations)

- **Never bypass with lint suppression**: Using `eslint-disable`, `@ts-ignore`, or comment hacks to bypass ratchet errors is strictly prohibited (`mms-agent-universal.md` §1).
- **Never modify historical migrations**: If an index is missing, add a forward migration; never edit past SQL migration files (`mms-data-layer.md` §4, skill `mms-schema-migrate`).
- **Never rename barrels during refactoring**: Public exports in `index.ts` must maintain backward compatibility.

## 3. Pre-Commit / Pre-Push Local CI

Before committing or pushing, run the unified local CI script:

```bash
# Run affected-only checks (fast pre-commit)
pnpm ci:local

# Run complete gate suite across monorepo
node scripts/verify-rules-integrity.mjs
```

## References

- AST & Heuristic Remediation Guide: `references/ratchet-remediation-guide.md`

## Related skills

`mms-code-review`, `mms-testing-e2e`, `mms-shared-ui`, `mms-shared-package`.
