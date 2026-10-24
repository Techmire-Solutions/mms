# MMS Project Skills

Agent skills for Cursor, Antigravity, and Claude Code. Cursor/Claude discover these from `description` frontmatter; Antigravity reads `.agent/skills/`.

**Antigravity:** start with [antigravity-workspace](antigravity-workspace/SKILL.md). Manifest: [.agent/skills-manifest.json](../skills-manifest.json)

## Skills index (49)

| Skill | Use when |
|-------|----------|
| [antigravity-workspace](antigravity-workspace/SKILL.md) | Starting work in Antigravity, loading project context, or syncing agent standards |
| [mms-a11y-smoke](mms-a11y-smoke/SKILL.md) | A11y conformance must be PROVEN for a change (run the axe spec, triage serious/critical violations) |
| [mms-agent-standards](mms-agent-standards/SKILL.md) | Adding or editing a rule or skill, when a skill is not firing, or when the standards verifier fails |
| [mms-audit-trail](mms-audit-trail/SKILL.md) | Tracking entity mutations, compliance exports, or right-to-erasure events |
| [mms-backend-api](mms-backend-api/SKILL.md) | Creating API endpoints, db sync, students/contacts REST, error handling, or backend services |
| [mms-backend-security](mms-backend-security/SKILL.md) | Hardening or auditing a security mechanism (correctness of the control itself) |
| [mms-background-jobs](mms-background-jobs/SKILL.md) | Adding or changing background processing, export downloads, job tray UX, or queued sync recovery |
| [mms-backup-restore](mms-backup-restore/SKILL.md) | Modifying BackupRestore UI, /api/db/backup or /api/db/sync, backup crypto, or restore safety gates |
| [mms-ci-ratchets](mms-ci-ratchets/SKILL.md) | A local or CI ratchet script fails or when verifying pre-PR compliance |
| [mms-code-review](mms-code-review/SKILL.md) | A specific diff must be accepted or rejected before merge |
| [mms-data-import](mms-data-import/SKILL.md) | Adding or modifying CSV import dialogs, module POST /import endpoints, or batch data onboarding pipelines |
| [mms-data-sync](mms-data-sync/SKILL.md) | Modifying legacy storage keys, local drafts, or document sync endpoints |
| [mms-db-performance](mms-db-performance/SKILL.md) | A list, report, or dashboard is slow, a query plan regressed, or DB load is climbing |
| [mms-dependency-upgrade](mms-dependency-upgrade/SKILL.md) | Bumping Node/pnpm/React/Vite/Fastify/Drizzle/Zod/Query, enabling Dependabot, or turning on React Compiler |
| [mms-dev-setup](mms-dev-setup/SKILL.md) | Installing dependencies, starting dev servers, fixing env issues, or onboarding to the project |
| [mms-error-triage](mms-error-triage/SKILL.md) | Investigating a reported bug, an error spike, or a Sentry alert that needs a root cause and an owning fix |
| [mms-faculty-domain](mms-faculty-domain/SKILL.md) | Modifying faculty tables, appointments, or staff directory/drawers |
| [mms-fields-registry](mms-fields-registry/SKILL.md) | Working with custom fields, system tabs, field types, column registries, field delete guards, or getSortedFields |
| [mms-finance-accounting](mms-finance-accounting/SKILL.md) | Modifying finance or accounting features, payment gateways, invoice templates, or ledger entries |
| [mms-form-architecture](mms-form-architecture/SKILL.md) | Building or auditing create/edit forms, FormModal tabs, DatePicker/TimePicker/DateTimePicker/phone fields, or upload flows |
| [mms-frontend](mms-frontend/SKILL.md) | Editing apps/frontend, Vite config, frontend hooks, pages, components, or frontend tests |
| [mms-i18n-completeness](mms-i18n-completeness/SKILL.md) | Adding user-facing text, when check:i18n fails, or when a locale renders English or overflows |
| [mms-incident-response](mms-incident-response/SKILL.md) | Production is down, a deploy broke the site, or a release must be reverted |
| [mms-linux-compatibility](mms-linux-compatibility/SKILL.md) | Preparing a deploy or chasing an error that only reproduces on the server |
| [mms-messaging](mms-messaging/SKILL.md) | Modifying MessagingPage, MessageComposer, messaging templates/campaigns/logs, MessagingVariableTokensBar, or backend messaging routes/repositories |
| [mms-migration-fixes](mms-migration-fixes/SKILL.md) | Working an item that is explicitly listed as open debt in that register |
| [mms-module-page](mms-module-page/SKILL.md) | Adding a module page, aligning tab navigation, or aligning an existing module to universal architecture |
| [mms-module-setup](mms-module-setup/SKILL.md) | Configuring module settings, setup sub-tabs, or module preferences |
| [mms-module-work](mms-module-work/SKILL.md) | Changing PageHeader command centre, Work directory, trash/restore, bulk actions, detail drawers, filters, or mobile cards |
| [mms-notifications](mms-notifications/SKILL.md) | Modifying NotificationsPage, in-app notification delivery, read receipts, or notification badge UI |
| [mms-ops-deploy](mms-ops-deploy/SKILL.md) | Fixing a production server, a failed deploy, or wrong domain routing |
| [mms-platform-console](mms-platform-console/SKILL.md) | Working under apps/frontend/src/platform, apps/backend/src/platform, or e2e/tests/platform |
| [mms-query-factories](mms-query-factories/SKILL.md) | Building query hooks, data fetching facades under @/tenant/hooks/collections/*, or caching mutations |
| [mms-queue-ops](mms-queue-ops/SKILL.md) | A background export/import, PDF render, messaging broadcast, or settings job never completes, or when the worker process is unhealthy |
| [mms-realtime-events](mms-realtime-events/SKILL.md) | Dispatching live update events from backend services, adding websocket channels, or subscribing to realtime updates in frontend hooks |
| [mms-release-versioning](mms-release-versioning/SKILL.md) | Cutting a release, tagging a deploy, recording a closed migration milestone, or marking work complete in the debt register |
| [mms-reports-export](mms-reports-export/SKILL.md) | Editing Reports tabs, KPIs, ExportToolbar, drill-down, saved reports, or dashboard widgets |
| [mms-schema-migrate](mms-schema-migrate/SKILL.md) | Changing schema.ts, writing SQL migrations, or reviewing DDL PRs |
| [mms-seed-fixtures](mms-seed-fixtures/SKILL.md) | Adding seed data for new modules, resetting local development databases, or crafting deterministic E2E test fixtures |
| [mms-settings-i18n](mms-settings-i18n/SKILL.md) | Adding or modifying settings, sidebar navigation items, custom localizations, translation files, or RTL/LTR layout mirroring |
| [mms-shared-package](mms-shared-package/SKILL.md) | Adding shared types, formatDate, formatMoney, parsePhoneNumber, manifests, or moving duplicated logic to packages/shared |
| [mms-shared-ui](mms-shared-ui/SKILL.md) | Creating, modifying, moving, auditing, or refactoring UI primitives across Tenant and Platform consoles, or checking for orphaned/duplicate components |
| [mms-soft-delete](mms-soft-delete/SKILL.md) | Adding or changing soft-delete, trash directories, restore handlers, DDL migrations, or auditing deletion lifecycles |
| [mms-student-lifecycle](mms-student-lifecycle/SKILL.md) | Modifying student, enrollment, attendance, examination, or hasanat features |
| [mms-testing-e2e](mms-testing-e2e/SKILL.md) | Writing, running, or debugging frontend, backend, shared package, or end-to-end tests |
| [mms-ui-ux-design](mms-ui-ux-design/SKILL.md) | Designing UI/UX components, enforcing logical CSS properties for BiDi layouts, or adhering to the layout contract |
| [mms-user-management](mms-user-management/SKILL.md) | Modifying UsersPage, user invitation dialogs, tenant RBAC role assignments, or staff access controls |
| [mms-vuln-response](mms-vuln-response/SKILL.md) | Pnpm audit, Dependabot, dependency-review, or gitleaks reports a finding and it must be fixed or explicitly accepted |
| [ui-ux-pro-max](ui-ux-pro-max/SKILL.md) | Generating design systems, selecting styles/palettes/typography, or retrieving UX & chart guidelines |
## Rules vs skills

| Layer | Location | Behavior |
|-------|----------|----------|
| **Rules** | `.cursor/rules/*.mdc` | Auto-applied (always or by glob) — norms/SSOT |
| **Skills** | `.cursor/skills/*/SKILL.md` | Invoked when description matches — workflows/checklists that **point** at rules |

Always-on rule: `mms-core`. Requestable (not always-on): `mms-agent-universal`, `mms-completion-review`. Scoped examples: `mms-performance`, `mms-migration-status`, `mms-dry`, `mms-dependencies`, `mms-structure-naming` (49 skills; rules: 1 always-on + 20 scoped).

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
