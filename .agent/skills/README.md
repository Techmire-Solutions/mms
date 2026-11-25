# MMS Project Skills

Agent skills for Cursor, Antigravity, and Claude Code. Cursor/Claude discover these from `description` frontmatter; Antigravity reads `.agent/skills/`.

**Antigravity:** start with [antigravity-workspace](antigravity-workspace/SKILL.md). Manifest: [.agent/skills-manifest.json](../skills-manifest.json)

## Skills index (51)

| Skill | Use when |
|-------|----------|
| [antigravity-workspace](antigravity-workspace/SKILL.md) | Starting in Antigravity or syncing agent standards |
| [mms-a11y-smoke](mms-a11y-smoke/SKILL.md) | A11y conformance must be PROVEN |
| [mms-agent-standards](mms-agent-standards/SKILL.md) | Editing a rule/skill or the verifier/sync fails |
| [mms-audit-trail](mms-audit-trail/SKILL.md) | Mutation tracking, compliance exports, erasure |
| [mms-backend-api](mms-backend-api/SKILL.md) | API endpoints, REST, error handling |
| [mms-backend-security](mms-backend-security/SKILL.md) | Hardening/auditing a control |
| [mms-background-jobs](mms-background-jobs/SKILL.md) | Background processing or job tray UX |
| [mms-backup-restore](mms-backup-restore/SKILL.md) | BackupRestore UI or /api/db/backup|sync |
| [mms-ci-ratchets](mms-ci-ratchets/SKILL.md) | A ratchet fails |
| [mms-code-review](mms-code-review/SKILL.md) | A diff must be accepted/rejected |
| [mms-contacts](mms-contacts/SKILL.md) | Contacts tables, directory/drawers, dedup, or /api/contacts |
| [mms-data-import](mms-data-import/SKILL.md) | CSV dialogs, /import endpoints, batch onboarding |
| [mms-data-sync](mms-data-sync/SKILL.md) | Legacy storage keys/drafts |
| [mms-db-performance](mms-db-performance/SKILL.md) | A query/dashboard is slow |
| [mms-dependency-upgrade](mms-dependency-upgrade/SKILL.md) | Bumping Node/pnpm/React/Vite/Fastify/Drizzle/Zod/Query |
| [mms-dev-setup](mms-dev-setup/SKILL.md) | Installing deps, starting servers, fixing env |
| [mms-document-templates](mms-document-templates/SKILL.md) | Template editor/persistence/print |
| [mms-error-triage](mms-error-triage/SKILL.md) | Bug/error investigation |
| [mms-faculty-domain](mms-faculty-domain/SKILL.md) | Faculty tables/appointments/directory |
| [mms-fields-registry](mms-fields-registry/SKILL.md) | Custom fields, system tabs, column registries, delete guards |
| [mms-finance-accounting](mms-finance-accounting/SKILL.md) | Finance/accounting features |
| [mms-form-architecture](mms-form-architecture/SKILL.md) | Create/edit forms, pickers, uploads, form audit |
| [mms-frontend](mms-frontend/SKILL.md) | Apps/tenant-web, hooks, pages, components, tests |
| [mms-i18n-completeness](mms-i18n-completeness/SKILL.md) | Check:i18n fails or copy is untranslated |
| [mms-incident-response](mms-incident-response/SKILL.md) | Prod is down or a deploy broke the site |
| [mms-linux-compatibility](mms-linux-compatibility/SKILL.md) | Preparing a deploy or chasing server-only errors |
| [mms-messaging](mms-messaging/SKILL.md) | Messaging features/routes/repos |
| [mms-migration-fixes](mms-migration-fixes/SKILL.md) | Items in that register |
| [mms-module-page](mms-module-page/SKILL.md) | Module page/nav alignment |
| [mms-module-setup](mms-module-setup/SKILL.md) | Module settings/setup |
| [mms-module-work](mms-module-work/SKILL.md) | Command centre/Work directory |
| [mms-notifications](mms-notifications/SKILL.md) | Notification delivery/badges |
| [mms-ops-deploy](mms-ops-deploy/SKILL.md) | Deploy/server fixes |
| [mms-platform-console](mms-platform-console/SKILL.md) | Apps/platform-web/src/platform, apps/api/src/platform, e2e platform |
| [mms-query-factories](mms-query-factories/SKILL.md) | Query hooks/facades |
| [mms-queue-ops](mms-queue-ops/SKILL.md) | A job never completes |
| [mms-realtime-events](mms-realtime-events/SKILL.md) | Live updates/subscriptions |
| [mms-release-versioning](mms-release-versioning/SKILL.md) | Cutting a release |
| [mms-reports-export](mms-reports-export/SKILL.md) | Reports tabs/KPIs/exports |
| [mms-schema-migrate](mms-schema-migrate/SKILL.md) | Schema.ts/SQL/DDL review |
| [mms-seed-fixtures](mms-seed-fixtures/SKILL.md) | Seed data/E2E fixtures |
| [mms-settings-i18n](mms-settings-i18n/SKILL.md) | Settings/nav/translations |
| [mms-shared-package](mms-shared-package/SKILL.md) | Shared types/utils |
| [mms-shared-ui](mms-shared-ui/SKILL.md) | Shared UI primitives/audits |
| [mms-soft-delete](mms-soft-delete/SKILL.md) | Soft-delete/trash/restore |
| [mms-student-lifecycle](mms-student-lifecycle/SKILL.md) | Student/enrollment/attendance/exam features |
| [mms-testing-e2e](mms-testing-e2e/SKILL.md) | Writing/running/debugging tests |
| [mms-ui-ux-design](mms-ui-ux-design/SKILL.md) | UI/UX design, logical CSS, layout |
| [mms-user-management](mms-user-management/SKILL.md) | UsersPage/invites/RBAC |
| [mms-vuln-response](mms-vuln-response/SKILL.md) | Pnpm audit/Dependabot/gitleaks findings |
| [ui-ux-pro-max](ui-ux-pro-max/SKILL.md) | Design systems/palettes/typography/UX reviews |
## Rules vs skills

| Layer | Location | Behavior |
|-------|----------|----------|
| **Rules** | `.cursor/rules/*.mdc` | Auto-applied (always or by glob) — norms/SSOT |
| **Skills** | `.cursor/skills/*/SKILL.md` | Invoked when description matches — workflows/checklists that **point** at rules |

DeepSeek Harness: `.dsh/skills/<name>/SKILL.md` is auto-discovered (project rank 100) and `.dsh/rules/*.md` mirrors the rule bodies for on-demand reading (index: `.dsh/AGENTS.md`).

Always-on rules: `mms-core`, `mms-completion-review`. Requestable (model-decided): `mms-agent-universal`. Scoped examples: `mms-performance`, `mms-migration-status`, `mms-dry`, `mms-dependencies`, `mms-structure-naming` (51 skills; rules: 2 always-on + 22 scoped).

## Verify setup

```bash
bash .agent/skills/mms-dev-setup/scripts/verify-env.sh
pnpm install && pnpm typecheck && pnpm test
```

## Antigravity / Claude / Cursor mirror

| Tool | Skills path |
|------|-------------|
| Antigravity | `.agent/skills/` (canonical) |
| Cursor | `.cursor/skills/` |
| Claude Code | `.claude/skills/` |

After editing skills or rules:

```bash
bash .agent/scripts/sync-all.sh
```
