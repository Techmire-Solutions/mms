---
name: mms-release-versioning
description: Manages MMS release bookkeeping — version bumps, changelog entries, migration-milestone updates, and deploy SHA handoff. Use when cutting a release, tagging a deploy, recording a closed migration milestone, or marking work complete in the debt register. Do NOT use for the deploy mechanics themselves (use mms-ops-deploy), for dependency version bumps (use mms-dependency-upgrade), or for rules/skills versioning (use mms-agent-standards).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Release & Versioning

**Rules (norms SSOT):** `mms-ops-infrastructure.md` (CI/deploy flow, `DEPLOY_SHA`) · `mms-migration-status.md` (debt register) · `mms-dependencies.md` (dependency versions) · `mms-agent-universal.md` (git discipline).

## When to use

- Cutting a release, tagging a deploy, or recording a closed migration milestone
- Updating dependency cadence or debt-register bookkeeping for a ship

## What "a release" means here

The repository is a private monorepo deployed from `main` via GitHub Actions → `DEPLOY_SHA` → tarball on the Hetzner host with retained releases in `.deploy-releases/`. There is **no** published package version: `apps/frontend/package.json` is `0.0.0` and the apps are never published. So a "release" is a deployable commit plus its bookkeeping — not an npm publish.

| Artifact | Source of truth | Update when |
|---|---|---|
| Deployed code | `main` + `DEPLOY_SHA` | every deploy |
| Dependency versions | `pnpm-workspace.yaml` catalog + package manifests | dependency passes (`.agent/skills/mms-dependency-upgrade/scripts/audit-deps.sh`) |
| Migration milestones | `docs/migration-milestones.md` | a documented migration closes |
| Open debt | `.agent/rules/mms-migration-status.md` | debt is opened, closed, or re-scoped |
| Agent standards | `AGENTS.md` / rules / skills | conventions change (verify with `node scripts/verify-rules-integrity.mjs`) |

## Procedure

1. **Confirm the tree is release-ready**, in this order: `pnpm typecheck` → `pnpm lint` → `pnpm test` → `pnpm test:e2e` for anything touching auth/routing/onboarding → `node scripts/verify-rules-integrity.mjs` → `pnpm audit --audit-level=high`. Do not skip a gate because the change "felt small"; `mms-completion-review.md` lists the scoped checks per change type.
2. **Check migrations are release-safe:** no write-blocking `CREATE INDEX`, forward-only, and — for anything that already ran in an environment — remember a rollback does **not** reverse it (`mms-data-layer.md` §7).
3. **Write the changelog entry** in the release/PR description, grouped by Conventional Commit type, and call out explicitly: schema changes, env-var additions (with the `apps/backend/.env.example` update), security fixes, and any behaviour change users will notice.
4. **Update the registers** that the next agent will actually read:
   - closed migration work → `docs/migration-milestones.md`, and remove the row from the open register in `mms-migration-status.md`;
   - new known debt → a concrete row (paths, counts, owner) in the open register — vague rows are unactionable and were explicitly reworked;
   - convention changes → the owning rule/skill plus `bash .agent/scripts/sync-all.sh`.
5. **Hand off the deploy SHA** rather than describing the change in prose. The deploy pipeline needs `DEPLOY_SHA`; the rollback path needs the previous release to still exist in `.deploy-releases/`.
6. **Verify after deploy** with `bash scripts/deploy-verify.sh` and a real tenant login (`mms-ops-deploy`, `mms-incident-response`).

## Do not

- Bump `apps/frontend`/`apps/backend` `version` fields as a release gesture — nothing consumes them, and a fake version is worse than none.
- Tag or push anything: git operations belong to the user (`mms-agent-universal.md`).
- Mark a milestone closed while its verification is unrun.
- Delete a row from the debt register without moving it to `docs/migration-milestones.md`.

## Related skills

`mms-ops-deploy` (deploy + Apache/PM2), `mms-incident-response` (rollback), `mms-migration-fixes` (the open debt register itself), `mms-dependency-upgrade` (dependency cadence).
