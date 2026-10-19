# MMS — Agent Guide

Madrasa Management System monorepo. This file is the cross-tool standard: **Cursor**, **Codex**, **Copilot agents**, **Windsurf**, and **Antigravity** read it directly; **Claude Code** reads it through the `@AGENTS.md` import at the top of `CLAUDE.md`.

## Quick commands

```bash
pnpm install && pnpm typecheck
pnpm install && ./restart_servers.sh   # local dev (screen)
bash .agent/skills/mms-dev-setup/scripts/verify-env.sh   # env + services check
node scripts/verify-rules-integrity.mjs                  # rules/skills gate
pnpm ci:local                                            # path-aware local CI before commit/push
pnpm ci:local:full                                       # + i18n/build/bundle
```

## Layout

```
apps/frontend/     React 19 + Vite 8 · TanStack Query v5 · Tailwind v4
apps/backend/      Fastify 5 + Node.js 24 + PostgreSQL 16 + Drizzle · BullMQ worker
packages/shared/   @mms/shared — types, Zod DTOs, manifests, pure utils (SSOT)
e2e/               Playwright suites + axe helpers
```

## Agent standards layout

```
AGENTS.md            ← this file: the cross-tool source of truth
CLAUDE.md            ← thin wrapper: `@AGENTS.md` import + Claude-only notes
.agent/
  rules/             # canonical rule bodies are edited in .cursor/rules/ and mirrored here
  skills/            # CANONICAL skills (SKILL.md per folder + scripts/ references/ examples/)
  workflows/         # multi-step procedures (invoked as /dev-setup, /feature-module, …)
  scripts/           # sync-all.sh, sync-rules.sh, sync-skills.sh, sync-claude.sh
  skills-manifest.json
.cursor/
  rules/*.mdc        # CANONICAL rule sources (globs + alwaysApply)
  skills/            # generated mirror of .agent/skills/
  hooks.json         # afterFileEdit → format, beforeShellExecution → guard
  commands/          # /dev-setup, /feature-module, /code-review, /dry, /run-tests, /fix-migration-debt, /shared-ui-audit
.claude/
  rules/             # generated mirror (paths: frontmatter)
  skills/            # generated mirror
  agents/            # mms-reviewer, mms-explorer, mms-test-triage, mms-docs-auditor
  commands/          # same six workflow commands
  settings.json      # team permissions (deny-list) + hooks
```

Start here in Antigravity: **skill `antigravity-workspace`**.

## Always-on rules (all tools)

| Antigravity         | Cursor               |
| ------------------- | -------------------- |
| `rules/mms-core.md` | `rules/mms-core.mdc` |

## Browser support policy & Modern Web Guidance

**Modern evergreen browsers.** Use Baseline Newly Available web features natively behind feature detection with graceful degradation. No polyfills; no fallbacks for non-Baseline features unless one is required for core functionality.

**Modern Web Guidance (`modern-web-guidance`):** MANDATORY for all HTML/CSS and client-side JS tasks across the whole project. Search guides first (`pnpx modern-web-guidance@latest search "<query>"` / `retrieve "<id>"`) before implementing UI/layout, forms, dialogs/popovers, animations, scroll/motion, or CWV/performance optimizations. Never guess deprecated web APIs; adhere to modern Baseline standards and disclose guide usage.

## Plan first, task list, then execute — applies to every request

On receiving any request, systematically plan before modifying code:

1. **Discover & Plan**: Inspect the codebase, locate relevant files/abstractions, clarify requirements, evaluate modern web guides (`modern-web-guidance`), and identify boundaries (tenant isolation, 300 LOC cap, strict TS).
2. **Actionable Task List**: Formulate an explicit, ordered task checklist (`- [ ]`) decomposing the work into discrete, verifiable phases.
3. **Iterative Execution & Verification**: Execute task-by-task against the checklist, update progress (`- [x]`), apply surgical changes, and verify (typecheck/lint/test) after each phase before declaring completion. Never guess APIs or modify code without prior discovery.

Owners: always-on `mms-core` §3 (**Workflow Discipline**) · universal standards `mms-agent-universal` §1 (**Cognition & Behaviour**).

## Reuse first (DRY) — applies to every change

Before implementing any feature, look for existing components, hooks, utilities, layouts, forms, dialogs, and patterns that can be reused or extended. Keep shared behaviour in reusable, configurable implementations; never duplicate UI or business logic across pages. Changes to shared components must stay compatible with their existing consumers — find them, run their tests, and verify the affected pages. Follow the project's design conventions and the `ui-ux-pro-max` skill for UI/UX work. Tabular data uses the shared `DataTable` / `WorkBatchTable` stack.

Owners: always-on `mms-agent-universal` §1 (**Reuse First**) · workflow and thresholds `mms-dry` §1–§2 · tables ratchet `pnpm run check:work-directory`.

## Module access gates — applies to every module-owned surface

Every module-owned route, UI entry point, and backend operation must declare and enforce its module and action-permission requirements. Frontend visibility is not a security boundary. Backend authorization must use authoritative tenant grants, module enablement, and user permissions. Reuse the centralized policy and guards. Explicitly classify non-module routes and add coverage checks so new routes or endpoints cannot silently bypass authorization.

Owners: norm `mms-auth-security` §3 (**Module Access Gates**) · policy `@mms/shared` `moduleAccessPolicy.ts` · backend `registerModuleAccess` + `MODULE_ROUTE_ACTION_RULES` · frontend `TENANT_APP_ROUTE_ACCESS` + `ModuleAccessRoute` · checks `apps/backend/src/__tests__/moduleAccessCoverage.test.ts` and `apps/frontend/src/lib/config/routeAccess.test.ts`.

**Rule → skill map:** every rule carries a **Workflow skills:** line, and the full ownership matrix lives in [.cursor/rules/README.md](.cursor/rules/README.md) (that file is the single owner of the topic→rule→skill index — do not restate it here).

## Skills (49)

| Skill                     | Purpose                                                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `antigravity-workspace`   | Where rules/skills live; sync policy                                                                                                                        |
| `mms-a11y-smoke`          | axe + shell a11y verification                                                                                                                               |
| `mms-agent-standards`     | Authoring/verifying rules, skills, commands, hooks                                                                                                          |
| `mms-audit-trail`         | Audit trail, RFC 8785 canonical JSON, sharded hash chains, partitions                                                                                       |
| `mms-backend-api`         | Fastify backend                                                                                                                                             |
| `mms-backend-security`    | Tenant isolation, RBAC, cookies, CSRF                                                                                                                       |
| `mms-background-jobs`     | Queued exports/imports, progress, artifacts                                                                                                                 |
| `mms-backup-restore`      | Encrypted backup / wipe-restore                                                                                                                             |
| `mms-ci-ratchets`         | Diagnosing and resolving custom CI gates and boundary ratchets                                                                                              |
| `mms-code-review`         | Change-set review before merge                                                                                                                              |
| `mms-data-import`         | Bulk CSV and tabular data import workflows — file ingestion, mapping, dry-run validation, and queued batch onboarding                                       |
| `mms-data-sync`           | db.ts & API sync                                                                                                                                            |
| `mms-db-performance`      | Query/index/autovacuum triage                                                                                                                               |
| `mms-dependency-upgrade`  | Catalogs, Dependabot, audits, React Compiler                                                                                                                |
| `mms-dev-setup`           | Install, run, env verify                                                                                                                                    |
| `mms-error-triage`        | Sentry issue → traceparent → audit row                                                                                                                      |
| `mms-faculty-domain`      | Faculty staff hierarchy, temporal appointments, designations, departments                                                                                   |
| `mms-fields-registry`     | Fields & tabs, field guards                                                                                                                                 |
| `mms-finance-accounting`  | Invoices, payments, double-entry ledger                                                                                                                     |
| `mms-form-architecture`   | Static FormModal, shared Zod, uploads                                                                                                                       |
| `mms-frontend`            | React app shell, apiClient, Query vs localStorage, FE tests                                                                                                 |
| `mms-i18n-completeness`   | Key parity across en/ar/ur/fa                                                                                                                               |
| `mms-incident-response`   | Diagnose → rollback → verify a bad deploy                                                                                                                   |
| `mms-linux-compatibility` | Linux/Ubuntu VPS compatibility                                                                                                                              |
| `mms-messaging`           | SMS/WhatsApp campaigns                                                                                                                                      |
| `mms-migration-fixes`     | Open debt priorities P1–P7                                                                                                                                  |
| `mms-module-page`         | Three-tier module pages + gold-standard parity (§7)                                                                                                         |
| `mms-module-setup`        | Setup tier — Preferences, sub-tabs, setup audit                                                                                                             |
| `mms-module-work`         | Work tier — metrics, directory, drawer, trash                                                                                                               |
| `mms-notifications`       | In-app notification center, real-time unread badges, notification preferences, and event-driven alert triggers                                              |
| `mms-ops-deploy`          | Hetzner deploy, Apache isolation, PORT 5002                                                                                                                 |
| `mms-platform-console`    | Platform Apex routes, auth, workspace provisioning, and admin console                                                                                       |
| `mms-query-factories`     | TanStack Query factories / optimistic policy                                                                                                                |
| `mms-queue-ops`           | Diagnose stuck/failed BullMQ jobs; replay safely                                                                                                            |
| `mms-realtime-events`     | WebSocket `/api/ws` pipeline, live push invalidation, and progress                                                                                          |
| `mms-release-versioning`  | Version bumps, changelog, milestone bookkeeping                                                                                                             |
| `mms-reports-export`      | Analytics & export                                                                                                                                          |
| `mms-schema-migrate`      | Forward-only Drizzle DDL, lock-safe indexes                                                                                                                 |
| `mms-seed-fixtures`       | Database seed scripts, demo tenant fixtures, and test resets                                                                                                |
| `mms-settings-i18n`       | Settings + i18n (en/ar/ur/fa)                                                                                                                               |
| `mms-shared-package`      | `@mms/shared` purity and exports                                                                                                                            |
| `mms-shared-ui`           | Shared UI architecture (`@shared/ui`) — ban duplicates, migrate legacy files, check orphaned imports (rule: `mms-shared-ui` · workflow: `/shared-ui-audit`) |
| `mms-soft-delete`         | Soft-Delete System, 3-tier indexing, restore, outbox CDC, hard-purge                                                                                        |
| `mms-student-lifecycle`   | Admissions, enrollments, attendance marking, exams, and grading                                                                                             |
| `mms-testing-e2e`         | Vitest, Playwright E2E & axe smoke                                                                                                                          |
| `mms-ui-ux-design`        | Design tokens, BiDi / RTL layout, Master Module Scaffold                                                                                                    |
| `mms-user-management`     | Tenant staff user management, role assignments, staff invitations, and active session controls                                                              |
| `mms-vuln-response`       | Triage and respond to a dependency advisory                                                                                                                 |
| `ui-ux-pro-max`           | Design intelligence (styles, palettes, typography, UX, charts)                                                                                              |

Index: [.agent/skills/README.md](.agent/skills/README.md)

## Workflows

[.agent/workflows/](.agent/workflows/) — `dev-setup`, `feature-module`, `code-review`, `fix-migration-debt`, `dry`, `run-tests`, `shared-ui-audit`. Available as slash commands in Cursor (`.cursor/commands/`) and Claude Code (`.claude/commands/`); Antigravity reads the folder directly.

| Workflow          | When to invoke                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `shared-ui-audit` | Audit frontend for duplicate/orphaned UI components, enforce `@shared/ui` SSOT, run pre-deletion validation |

## Editing standards

**Canonical sources — edit these, never the mirrors:**

| Artifact         | Canonical                                                             | Generated mirrors                                            |
| ---------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| Rules            | `.cursor/rules/*.mdc`                                                 | `.agent/rules/*.md`, `.claude/rules/*.md`                    |
| Skills           | `.agent/skills/*/SKILL.md` (+ `scripts/`, `references/`, `examples/`) | `.cursor/skills/`, `.claude/skills/`                         |
| Workflows        | `.agent/workflows/*.md`                                               | `.claude/docs/workflows/` (commands read the canonical path) |
| Docs (this file) | `AGENTS.md`                                                           | `CLAUDE.md` imports it                                       |

Rule **bodies** are byte-identical across the three rule trees; only frontmatter differs:

| Tool        | Frontmatter                            |
| ----------- | -------------------------------------- |
| Cursor      | `globs` + `alwaysApply`                |
| Antigravity | `trigger: always_on \| model_decision` |
| Claude Code | `paths:` (scoped) or none (always-on)  |

Cross-references use `.mdc` in Cursor and `.md` in Antigravity/Claude — the sync script rewrites only rule-name references, never `.cursor/...` paths.

**After editing standards:**

```bash
bash .agent/scripts/sync-all.sh              # regenerate mirrors (add --dry-run for a preview)
node scripts/verify-rules-integrity.mjs      # gate: frontmatter, paths, imports, globs, citations
```

CI fails if the mirrors are out of sync (`git diff --exit-code -- .agent .cursor .claude`) or the verifier reports an error. Both run in `.github/workflows/ci.yml`.

**Enforcement rule** (from `mms-agent-universal.mdc`): a norm is either machine-enforced (lint rule, ratchet script, CI check, hook, test) or explicitly labelled advisory. Land the check with the norm.

**22 rules** (1 always-on + 21 scoped) — index with the per-topic owner: [.cursor/rules/README.md](.cursor/rules/README.md).

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
