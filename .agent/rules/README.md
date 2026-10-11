# MMS Agent Rules

Project rules for the Madrasa Management System. Antigravity loads `.md` files from this directory (synced from Cursor `.mdc`).

**Architecture rules:** `mms-module-architecture.md`, `mms-ops-infrastructure.md`, `mms-ui-ux-design.md`, `mms-data-layer.md`.

## Always Applied (1)

| Rule | Purpose |
|------|---------|
| `mms-core.md` | Stack, boundaries, ownership matrix, edit discipline |

## Scoped Rules (20)

### Agent Cognition & Review (On-Demand)

| Rule | Focus / Topic |
|------|---------------|
| `mms-agent-universal.md` | Universal agent cognition, output economy, security, TS/git standards |
| `mms-completion-review.md` | Self-review after code edits — verify, fix bugs, then mark done |

### Architecture & Platform Standards

| Rule | Focus / Topic |
|------|---------------|
| `mms-dry.md` | DRY — single source of truth, extraction thresholds, `@mms/shared` exports |
| `mms-structure-naming.md` | Monorepo layout, colocation, **file-size cap (300 lines hard)**, Title Case on save, naming |
| `mms-dependencies.md` | Latest stable Node, pnpm, and workspace dependency upgrades |
| `mms-ops-infrastructure.md` | Local dev setup, environment variables, Docker backend ports, health endpoints, Linux compatibility, and CI orchestration |
| `mms-performance.md` | Performance & resource efficiency (DB, streaming, Redis caching, bundle, virtualization) |
| `mms-migration-status.md` | Residual open debt register (full gaps → `mms-migration-fixes` skill; closed milestones → `docs/migration-milestones.md`) |

### Backend, Data & Security

| Rule | Focus / Topic |
|------|---------------|
| `mms-data-layer.md` | PostgreSQL, Drizzle schema, migrations, database transactions, TanStack Query policy |
| `mms-api-interface.md` | apiClient, Fastify routes, error taxonomy, HTTP pagination, bulk PUT upsert |
| `mms-auth-security.md` | Auth, users, JWT session shapes, RBAC permissions, multi-tenant isolation, cookie policies, rate limits |

### Frontend Architecture & UI/UX

| Rule | Focus / Topic |
|------|---------------|
| `mms-ui-ux-design.md` | UI primitives, design tokens, tabs, notifications, a11y (RTL / WCAG), and **§4 responsiveness** (FormModal chrome → `mms-form-architecture.md`) |
| `mms-module-architecture.md` | Universal module manifest schemas, **§0 surface triad** (directory / DetailSheet / FormModal), three-tier tab layout, Work/Reports/Setup scopes, soft-delete, **gold-standard parity (§7)**, background jobs |
| `mms-form-architecture.md` | Static FormModal forms, **control decision table**, collection chrome (`FormCollectionShell` / `FormListFieldCard` / `FormCardTypeSelect`), write Zod `.strict()`, React 19 defaults, decimal-as-string, local multipart uploads |
| `mms-hooks.md` | Custom React hooks (Query recipes, page controllers / action handlers, Work layout) |
| `mms-fields.md` | Field and tab registry, system vs custom fields, tab enablement SSOT |
| `mms-settings-i18n.md` | Settings hierarchy, preview, navigation, translations, `formatDate` / `formatMoney` |

### Cross-Cutting Features & Testing

| Rule | Focus / Topic |
|------|---------------|
| `mms-messaging.md` | SMS/WhatsApp campaigns, `MessageComposer`, templates, and message-log soft-archive semantics |
| `mms-reports.md` | Analytics implementation & exports, KPI SSOT, `ExportToolbar`, saved reports |
| `mms-testing-observability.md` | Vitest, API tests, logging, ErrorBoundary, Sentry, request-id |

## Ownership matrix (topic → owner rule → workflow skill)

Single prose owner per topic. A duplicate essay elsewhere must be a short pointer —
`mms-agent-universal.md` makes that a banned operation, and the skills/scripts
in the enforcement registry below are how the norm is actually held.

| Topic | Owner rule | Workflow skill |
|---|---|---|
| Agent cognition, output economy, TS/git discipline | `mms-agent-universal.md` | `antigravity-workspace` |
| Stack, boundaries, layering, ownership | `mms-core.md` | `mms-dev-setup` |
| Post-edit verification | `mms-completion-review.md` | `mms-code-review` |
| Dependencies, engines, catalogs | `mms-dependencies.md` | `mms-dependency-upgrade` · `mms-vuln-response` |
| File structure, naming, size bands | `mms-structure-naming.md` | `mms-frontend` · `mms-shared-package` |
| DRY, extraction, `@mms/shared` boundaries | `mms-dry.md` | `mms-shared-package` |
| Auth, sessions, CSRF, RBAC, tenant isolation | `mms-auth-security.md` | `mms-backend-security` |
| REST contracts, errors, pagination, bulk PUT | `mms-api-interface.md` | `mms-backend-api` · `mms-frontend` |
| PostgreSQL, Drizzle, RLS, migrations, Query policy | `mms-data-layer.md` | `mms-schema-migrate` · `mms-query-factories` · `mms-db-performance` |
| Soft-delete lifecycle and index tiers | `mms-data-layer.md` §6 · `mms-module-architecture.md` | `mms-soft-delete` |
| Audit trail, tamper evidence, retention | `mms-data-layer.md` §5 | `mms-audit-trail` |
| Module pages, tiers, background jobs | `mms-module-architecture.md` | `mms-module-page` · `mms-background-jobs` · `mms-queue-ops` · `ui-ux-pro-max` |
| Page surface triad (directory / detail / write) | `mms-module-architecture.md` §0 | `mms-module-page` · `mms-module-work` · `mms-form-architecture` |
| Work directory, drawer, trash UX | `mms-module-architecture.md` | `mms-module-work` · `ui-ux-pro-max` |
| Setup tier, preferences, sub-tabs | `mms-module-architecture.md` | `mms-module-setup` |
| Field/tab registry and guards | `mms-fields.md` | `mms-fields-registry` |
| Forms, FormModal, write schemas, uploads | `mms-form-architecture.md` | `mms-form-architecture` · `ui-ux-pro-max` |
| Form collection rows / catalog quick-create chrome | `mms-form-architecture.md` §1, §3 | `mms-form-architecture` |
| Hooks, page controllers, facades | `mms-hooks.md` | `mms-query-factories` · `mms-frontend` |
| UI primitives, tokens, a11y, responsiveness | `mms-ui-ux-design.md` | `mms-ui-ux-design` · `ui-ux-pro-max` · `mms-a11y-smoke` |
| Settings, navigation, i18n keys | `mms-settings-i18n.md` | `mms-settings-i18n` · `mms-i18n-completeness` |
| Reports, analytics, exports | `mms-reports.md` | `mms-reports-export` · `ui-ux-pro-max` |
| Messaging campaigns and logs | `mms-messaging.md` | `mms-messaging` |
| Performance, caching, virtualization | `mms-performance.md` | `mms-db-performance` · `mms-frontend` |
| Testing, logging, telemetry, resilience | `mms-testing-observability.md` | `mms-testing-e2e` · `mms-error-triage` |
| Local CI before push | `mms-completion-review.md` | `mms-code-review` |
| Ops, ports, health, CI, deploy | `mms-ops-infrastructure.md` | `mms-ops-deploy` · `mms-incident-response` · `mms-linux-compatibility` |
| Open migration debt | `mms-migration-status.md` | `mms-migration-fixes` · `mms-release-versioning` |
| Finance / accounting / ledger | `mms-data-layer.md` · `mms-api-interface.md` | `mms-finance-accounting` |
| Agent standards corpus (rules/skills/mirrors) | `mms-agent-universal.md` · `mms-core.md` | `mms-agent-standards` |

## Enforcement registry (norm → how it is actually held)

A norm is either **machine-enforced** or explicitly **advisory** (`mms-agent-universal.md`).
Update this table in the same change that adds or removes a check.

| Norm | Enforced by | Kind |
|---|---|---|
| Cross-feature import boundary | `mms-boundary/no-cross-feature-imports` (ESLint, error) | lint |
| Physical directional CSS classes | `mms-bidi/no-physical-directional-classes` (ESLint, error) | lint |
| Surface/token misuse | `no-restricted-syntax` selectors (ESLint, warn — advisory until promoted) | lint |
| `any` in frontend source | `pnpm run check:code-norms` ratchet | ratchet |
| Raw hex colours / file-size bands | `pnpm run check:code-norms` ratchet | ratchet |
| Wildcard DB projections | `pnpm run check:db-projections` (CI) | ratchet |
| Write-blocking index in a migration | `pnpm run check:migration-indexes` (CI) | ratchet |
| Bundle budget | `pnpm run check:bundle` (CI, build-dist job) | ratchet |
| i18n completeness across en/ar/ur/fa | `pnpm run check:i18n` reports missing/English-equal values; currently does not fail on counts | advisory report |
| Dependency advisories | `pnpm audit --audit-level=high` + dependency-review (CI) | CI |
| Secrets in history | gitleaks (CI, full history) | CI |
| Workflow security (SHA pinning, no credential persistence, no template injection, gated triggers) | `workflow-lint` job: actionlint + zizmor `min-severity: medium` (CI) | CI |
| Deployed bytes match CI's build of the commit | `actions/attest-build-provenance` in CI + `gh attestation verify` in `deploy.yml` | CI |
| Rule/skill/mirror integrity | `node scripts/verify-rules-integrity.mjs` + sync drift diff (CI) | CI |
| Local CI before commit (gates + path-aware unit tests) | `.githooks/pre-commit` (secrets + staged-file ESLint); `.githooks/pre-push` (blocks `main`, runs affected-only `pnpm ci:local` / `scripts/ci/local-ci.sh`) | hook + script |
| `drizzle-kit push` / destructive rm / .env reads | `.cursor/hooks/guard-shell.sh` (Claude + Cursor hooks) | hook |
| Tenant RLS enablement per table | `mms-schema-migrate/scripts/check-migrations.sh` | skill script |
| Faculty hierarchy, temporal primary integrity, and tenant isolation | `facultyAssignmentValidation.test.ts`, `facultyAppointmentsDb.integration.test.ts` | test |
| Faculty domain legacy surface (retired Teacher/FDA) + required schema | `pnpm run check:faculty-domain` (CI, `typecheck-lint`) | CI |
| `@mms/shared` runtime purity | `pnpm run check:shared-purity` (CI, `typecheck-lint`) | CI |
| a11y serious/critical violations | `e2e/tests/a11y-shell.spec.ts` (CI e2e job) | test |
| Platform UI ownership (native controls, duplicate exports/JSX, semantic palette classes) | `apps/frontend/src/platform/platformUiArchitecture.test.ts` | test |
| Coverage floors (FE 41/39, BE 45/27) | vitest thresholds in each workspace | test |
| Work directory convergence (selection SSOT, two-layer bulk chrome, no dead adapters) | `pnpm run check:work-directory` | ratchet |
| Data tables use `DataTable` / `WorkBatchTable` (no hand-rolled `<Table>` outside the report/ledger allowlist) | `pnpm run check:work-directory` | ratchet |
| Reuse-first / consumer-compatible shared changes (`mms-dry` §1) | none — **advisory** (review discipline) | advisory |
| Every module-owned API route gated (`registerModuleAccess`), every route classified | `apps/backend/src/__tests__/moduleAccessCoverage.test.ts` | test |
| Every tenant app-shell route classified in `TENANT_APP_ROUTE_ACCESS` | `apps/frontend/src/lib/config/routeAccess.test.ts` | test |
| Tier structure, trunk tests, review criteria, UI/UX Pro Max design intelligence | none — **advisory** (review discipline) | advisory |


## Tenant = Platform Parity Principle

All rules in this directory apply **equally** to tenant workspace code and platform apex code. There is no separate ruleset for platform. Specifically:

| Rule | Applies to platform? |
|------|--------------------|
| Primitive components (`Button`, `FormModal`, `Table`, etc.) | ✅ Yes — no parallel platform forks |
| Design tokens (`@theme`, semantic colors, logical CSS) | ✅ Yes |
| WCAG AA a11y, RTL, touch targets | ✅ Yes |
| TanStack Query v5 factories, `AbortSignal` | ✅ Yes |
| Zod `.strict()` DTOs via `@mms/shared` | ✅ Yes |
| File size cap (300 lines hard), naming | ✅ Yes |
| `ErrorState` with hint description on list failures | ✅ Yes |
| `notify.*` for all toasts | ✅ Yes |
| Fastify layering (routes → services → repository) | ✅ Yes |

The only *differences* are intentional domain split: `authenticatePlatform` vs `authenticateTenant`; platform uses `platformUserCan`/`requirePlatformPermission` instead of `can()`; platform WS uses existing `/api/ws` tenant channel or its own mechanism — **no new parallel stacks**.

## Skills (Workflows)

`.cursor/skills/` — task-discovered workflow guides. Index: [../skills/README.md](../skills/README.md). Overview: [../../AGENTS.md](../../AGENTS.md).

Rules = norms/SSOT. Skills = workflows/checklists that **point** at rules (do not re-author norms).

Every rule starts with a **Workflow skills:** line; the full topic→rule→skill map is the Ownership matrix above. Quick routing:

| When working on… | Invoke skill |
|------------------|--------------|
| New module / three-tier page | `mms-module-page` (+ `mms-module-work` / `mms-module-setup`) |
| REST Query hooks / optimistic policy | `mms-query-factories` |
| Drizzle DDL / FORCE RLS | `mms-schema-migrate` |
| Auth / CSRF / cookies / RBAC | `mms-backend-security` |
| Fastify routes / `inject()` | `mms-backend-api` |
| FE shell / apiClient | `mms-frontend` |
| FormModal / Zod forms | `mms-form-architecture` |
| Backup wipe-restore | `mms-backup-restore` |
| Audit trails / tamper-evidence / retention | `mms-audit-trail` |
| Dep upgrades / catalogs | `mms-dependency-upgrade` |
| axe / focus-return | `mms-a11y-smoke` |
| UI design system / styles / palettes / UX guidelines | `ui-ux-pro-max` |
| Soft-delete / trash lifecycle / hard-purge | `mms-soft-delete` |
| Migration debt | `mms-migration-fixes` |
| PR / self-review | `mms-code-review` |

## Agent Mirrors

| Tool | Rules | Skills |
|------|-------|--------|
| **Antigravity** | `.agent/rules/*.md` | `.agent/skills/` |
| **Claude Code** | `.claude/rules/*.md` | `.claude/skills/` |
| **Cursor** | `.cursor/rules/*.mdc` (canonical for rule bodies) | `.cursor/skills/` |

**Sync policy:** rule bodies identical across all three; only frontmatter differs (Cursor: `globs` + `alwaysApply`; Antigravity: `trigger`; Claude: `paths` or always-on). Cross-references use `.mdc` in Cursor, `.md` elsewhere.

After editing standards:

```bash
bash .agent/scripts/sync-all.sh
```

## PR / Change Checklist

- [ ] `pnpm typecheck` && `pnpm test`
- [ ] Frontend lint if touched: `cd apps/frontend && pnpm lint`
- [ ] No new hardcoded labels/colours — see `mms-settings-i18n.md` (en/ar/ur/fa) + registries
- [ ] Module tiers respect isolation boundaries in `mms-module-architecture.md`
- [ ] Person-directory Work: `directoryViews: ['table','cards']` (never `list`) — `mms-module-architecture.md` §3
- [ ] Bulk PUT upsert / ban wipe-missing-rows — `mms-api-interface.md` §5; form close after `mutateAsync` — module-arch §7
- [ ] Write Zod `.strict()` — `mms-form-architecture.md`
- [ ] Work column widths persist (local + `/column-preferences`; merge preserves device widths) — `mms-module-architecture.md` §3
- [ ] Dashboard/report KPI cards use `/metrics` where available — `mms-reports.md`
- [ ] Setup Fields / form: tab enablement SSOT + enabled fields render in form **and** drawer — `mms-fields.md` / `mms-form-architecture.md`
- [ ] Shared logic in `@mms/shared` if cross-app or 2+ modules
- [ ] Touched app files stay under the hard 300 lines; splits keep public import barrels — `mms-structure-naming.md`
- [ ] No commit unless user requested
- [ ] Update **all mirrors** when changing standards: `bash .agent/scripts/sync-all.sh`
- [ ] Auth/write routes: `mms-auth-security.md` (do not OR entity write with `canEditSetup`)
- [ ] Backup/restore: admin + `canBulkSync`, safety backup + password step-up, sync timeout rollback, strip secrets / exclude credential tables — `mms-settings-i18n.md` / `mms-data-layer.md` / `mms-auth-security.md`
- [ ] Soft-delete: 3-tier indexes, partial unique indexes `WHERE deleted_at IS NULL`, URL sync `?view=trash`, 23505 conflict trap, session invalidation, outbox CDC — `mms-soft-delete`
- [ ] New UI: `mms-ui-ux-design.md` keyboard + labels + §4 responsive checklist (375 / 768 / 1440)
- [ ] New `@mms/shared` pure helpers: unit test per `mms-testing-observability.md`

## Removed / Merged (History)

| Removed | Merged into |
|---------|-------------|
| `antigravity-global.md` | Renamed & generalized to `mms-agent-universal.md` |
| `mms-ai-editing.md` | `mms-core` + `mms-agent-universal` |
| `mms-ops.md`, `mms-production-ports.md`, `mms-linux-compatibility.md`, `mms-ci.md`, `saas-architecture.md` | `mms-ops-infrastructure.md` |
| `mms-ui-visual.md`, `mms-ui-rendering.md`, `mms-ui-tabs.md`, `mms-ui-forms.md`, `mms-a11y.md` | `mms-ui-ux-design.md` |
| `mms-module-work.md`, `mms-module-setup.md`, `mms-module-isolation.md`, `mms-module-crosscutting.md`, `mms-background-jobs.md` | `mms-module-architecture.md` |
| `mms-shared-dry.md` | `mms-dry.md` |
| `mms-database.md`, `mms-query.md` | `mms-data-layer.md` |
| `mms-structure.md`, `mms-naming.md` | `mms-structure-naming.md` |
| `mms-auth.md`, `mms-rbac.md`, `mms-tenant.md`, `mms-security.md` | `mms-auth-security.md` |
| `mms-config.md`, `mms-settings-navigation.md`, `mms-i18n.md` | `mms-settings-i18n.md` |
| `mms-frontend.md`, `mms-backend.md` | `mms-api-interface.md` |
| `mms-contacts.md`, `mms-contact-link.md` | Completely Deleted |
| `mms-testing.md`, `mms-observability.md` | `mms-testing-observability.md` |

## Verify in Cursor

**Settings → Rules** — 1 always-apply rule (`mms-core`) + 20 scoped rules when matching paths are open (**21 total**).
