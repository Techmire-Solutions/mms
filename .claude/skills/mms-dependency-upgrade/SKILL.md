---
name: mms-dependency-upgrade
description: Upgrades MMS workspace dependencies with pnpm catalogs, Dependabot/Renovate + dependency-review, audits, and the React Compiler enablement checklist. Use when bumping Node/pnpm/React/Vite/Fastify/Drizzle/Zod/Query, enabling Dependabot, or turning on React Compiler. Do NOT use for routine feature bug fixes (use mms-frontend or mms-backend-api) or migration technical debt (use mms-migration-fixes).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Dependency Upgrade Workflow

**Rule (norms SSOT):** `mms-dependencies.md`. Also `mms-performance.md` §4 (Client Bundle & Asset Optimization), `mms-ops-infrastructure.md` (CI), `mms-agent-universal.md` (memo hygiene), `mms-completion-review.md`.

## When to use

- Bumping Node/pnpm/React/Vite/Fastify/Drizzle/Zod/Query or catalog entries
- Enabling Dependabot or turning on React Compiler

Do **not** use for day-to-day install/run → `mms-dev-setup`. Do **not** use for prod host deploy → `mms-ops-deploy`.

## Workflow

1. Confirm root `packageManager` + `engines.node` match CI/Docker exactly.
2. Prefer pnpm `catalog:` / `catalogs` for React, Vite, Fastify, Drizzle, Zod, TanStack Query — apps must not drift majors.
3. Bump via Dependabot/Renovate PR or a dedicated manual catalog edit (not mid-feature).
4. `pnpm install` then `pnpm audit` (or OSV) — fix/document high+ findings. Prefer `onlyBuiltDependencies` allowlist so arbitrary postinstall scripts stay off.
5. Read upstream major migration guides before landing breaking API changes.
6. `pnpm typecheck && pnpm test` + FE/BE lint when those apps changed.
7. **Tree-Shaking & Bundle Review**: Verify tree-shaking compatibility before introducing any new dependency. Ban monolithic utility libraries (`lodash`, `moment`, `ramda`) in favor of native JS and `@mms/shared`. Ban CommonJS-only packages that break Vite tree-shaking (`mms-performance.md`).
8. **React Compiler** (only if enabling): follow the current official integration for the selected Vite/React versions; configure frontend only and preserve existing Hooks lint. Advisory: adopt incrementally; retain manual memoization until identity/dependency semantics and behavior are verified. Update the stack note once enabled.
9. Keep GitHub `dependency-review` green on the PR.
10. Do not enable `exactOptionalPropertyTypes` mid-feature — dedicated TS-strictness PR only (`mms-dependencies.md`).

## Checklist

```
- [ ] Dedicated upgrade PR (not mixed with feature work)
- [ ] catalogs / majors aligned across apps
- [ ] engines + packageManager match CI/Docker
- [ ] audit clean or justified
- [ ] onlyBuiltDependencies / install-script allowlist reviewed when adding native deps
- [ ] typecheck + test + lint green
- [ ] Compiler integration and lint verified; no blanket memoization removal
- [ ] Banned Node 24 dependencies (dotenv, axios, node-fetch, ws, glob, fast-glob, path-to-regexp) are not reintroduced
- [ ] Tree-shaking verified; no banned monolithic libraries (lodash, moment, ramda) or CJS-only packages added
- [ ] Zero non-erasable TypeScript syntax (enum, namespace, parameter properties) for Node 24 --experimental-strip-types
- [ ] Native ECMAScript non-mutating methods used (toSorted, toReversed, toSpliced, with, Object.groupBy)
```

## Script

`.agent/skills/mms-dependency-upgrade/scripts/audit-deps.sh` — engines, catalog references, and advisories:

```bash
bash .agent/skills/mms-dependency-upgrade/scripts/audit-deps.sh                  # full audit (fails on high/critical advisories)
MMS_SKIP_AUDIT=1 bash .agent/skills/mms-dependency-upgrade/scripts/audit-deps.sh # offline: engines + catalog references only
```

A non-zero exit is actionable: fix the version, or add a reviewed exception **with a reachability analysis** to the `overrides` block in `pnpm-workspace.yaml` (the ts-deepmerge entry is the pattern to copy).

## Done

`mms-completion-review.md`. Sync standards mirrors only if you edited rules/skills.

## Related skills

`mms-vuln-response`, `mms-release-versioning`, `mms-dev-setup`, `mms-testing-e2e`.
