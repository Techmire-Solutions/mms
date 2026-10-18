# MMS Cursor Rules

Project rules for the Madrasa Management System. Cursor loads `.mdc` files from this directory automatically.

**Architecture rules:** `mms-module-architecture.mdc`, `mms-ops-infrastructure.mdc`, `mms-ui-ux-design.mdc`, `mms-data-layer.mdc`.

## Always Applied (1)

| Rule | Purpose |
|------|---------|
| `mms-core.mdc` | Stack, boundaries, ownership matrix, edit discipline |

## Scoped Rules (21)

### Agent Cognition & Review (On-Demand)

| Rule | Focus / Topic |
|------|---------------|
| `mms-agent-universal.mdc` | Universal agent cognition, output economy, security, TS/git standards |
| `mms-completion-review.mdc` | Self-review after code edits — verify, fix bugs, then mark done |

### Architecture & Platform Standards

| Rule | Focus / Topic |
|------|---------------|
| `mms-dry.mdc` | DRY — single source of truth, extraction thresholds, `@mms/shared` exports |
| `mms-structure-naming.mdc` | Monorepo layout, colocation, **file-size cap (300 lines hard)**, Title Case on save, naming |
| `mms-dependencies.mdc` | Latest stable Node, pnpm, and workspace dependency upgrades |
| `mms-ops-infrastructure.mdc` | Local dev setup, environment variables, Docker backend ports, health endpoints, Linux compatibility, and CI orchestration |
| `mms-performance.mdc` | Performance & resource efficiency (DB, streaming, Redis caching, bundle, virtualization) |
| `mms-migration-status.mdc` | Residual open debt register (full gaps → `mms-migration-fixes` skill; closed milestones → `docs/migration-milestones.md`) |

### Backend, Data & Security

| Rule | Focus / Topic |
|------|---------------|
| `mms-data-layer.mdc` | PostgreSQL, Drizzle schema, migrations, database transactions, TanStack Query policy |
| `mms-api-interface.mdc` | apiClient, Fastify routes, error taxonomy, HTTP pagination, bulk PUT upsert |
| `mms-auth-security.mdc` | Auth, users, JWT session shapes, RBAC permissions, multi-tenant isolation, cookie policies, rate limits |

### Frontend Architecture & UI/UX

| Rule | Focus / Topic |
|------|---------------|
| `mms-shared-ui.mdc` | @shared/ui SSOT, zero cross-console duplicates, pre-deletion gates, orphaned import detection |
| `mms-ui-ux-design.mdc` | UI primitives, design tokens, tabs, notifications, a11y (RTL / WCAG), and **§4 responsiveness** (FormModal chrome → `mms-form-architecture.mdc`) |
| `mms-module-architecture.mdc` | Universal module manifest schemas, **§0 surface triad** (directory / DetailSheet / FormModal), three-tier tab layout, Work/Reports/Setup scopes, soft-delete, **gold-standard parity (§7)**, background jobs |
| `mms-form-architecture.mdc` | Static FormModal forms, **control decision table**, collection chrome (`FormCollectionShell` / `FormListFieldCard` / `FormCardTypeSelect`), write Zod `.strict()`, React 19 defaults, decimal-as-string, local multipart uploads |
| `mms-hooks.mdc` | Custom React hooks (Query recipes, page controllers / action handlers, Work layout) |
| `mms-fields.mdc` | Field and tab registry, system vs custom fields, tab enablement SSOT |
| `mms-settings-i18n.mdc` | Settings hierarchy, preview, navigation, translations, `formatDate` / `formatMoney` |

### Cross-Cutting Features & Testing

| Rule | Focus / Topic |
|------|---------------|
| `mms-messaging.mdc` | SMS/WhatsApp campaigns, `MessageComposer`, templates, and message-log soft-archive semantics |
| `mms-reports.mdc` | Analytics implementation & exports, KPI SSOT, `ExportToolbar`, saved reports |
| `mms-testing-observability.mdc` | Vitest, API tests, logging, ErrorBoundary, Sentry, request-id |

## Ownership matrix (topic → owner rule → workflow skill)

Single prose owner per topic. A duplicate essay elsewhere must be a short pointer —
`mms-agent-universal.mdc` makes that a banned operation, and the skills/scripts
in the enforcement registry below are how the norm is actually held.

| Topic | Owner rule | Workflow skill |
|---|---|---|
| Agent cognition, output economy, TS/git discipline | `mms-agent-universal.mdc` | `antigravity-workspace` |
| Stack, boundaries, layering, ownership | `mms-core.mdc` | `mms-dev-setup` |
| Post-edit verification | `mms-completion-review.mdc` | `mms-code-review` |
| Dependencies, engines, catalogs | `mms-dependencies.mdc` | `mms-dependency-upgrade` · `mms-vuln-response` |
| File structure, naming, size bands | `mms-structure-naming.mdc` | `mms-frontend` · `mms-shared-package` · `mms-shared-ui` |
| DRY, extraction, `@mms/shared` boundaries | `mms-dry.mdc` | `mms-shared-package` · `mms-shared-ui` |
| Shared UI components & cross-console governance | `mms-shared-ui.mdc` (norm SSOT) · `mms-dry.mdc` §1,§4 · `mms-ui-ux-design.mdc` §1 | `mms-shared-ui` |
| Auth, sessions, CSRF, RBAC, tenant isolation | `mms-auth-security.mdc` | `mms-backend-security` |
| REST contracts, errors, pagination, bulk PUT | `mms-api-interface.mdc` | `mms-backend-api` · `mms-frontend` |
| PostgreSQL, Drizzle, RLS, migrations, Query policy | `mms-data-layer.mdc` | `mms-schema-migrate` · `mms-query-factories` · `mms-db-performance` |
| Soft-delete lifecycle and index tiers | `mms-data-layer.mdc` §6 · `mms-module-architecture.mdc` | `mms-soft-delete` |
| Audit trail, tamper evidence, retention | `mms-data-layer.mdc` §5 | `mms-audit-trail` |
| Module pages, tiers, background jobs | `mms-module-architecture.mdc` | `mms-module-page` · `mms-background-jobs` · `mms-queue-ops` · `ui-ux-pro-max` |
| Page surface triad (directory / detail / write) | `mms-module-architecture.mdc` §0 | `mms-module-page` · `mms-module-work` · `mms-form-architecture` |
| Work directory, drawer, trash UX | `mms-module-architecture.mdc` | `mms-module-work` · `ui-ux-pro-max` |
| Setup tier, preferences, sub-tabs | `mms-module-architecture.mdc` | `mms-module-setup` |
| Field/tab registry and guards | `mms-fields.mdc` | `mms-fields-registry` |
| Forms, FormModal, write schemas, uploads | `mms-form-architecture.mdc` | `mms-form-architecture` · `ui-ux-pro-max` |
| Form collection rows / catalog quick-create chrome | `mms-form-architecture.mdc` §1, §3 | `mms-form-architecture` |
| Hooks, page controllers, facades | `mms-hooks.mdc` | `mms-query-factories` · `mms-frontend` |
| UI primitives, tokens, a11y, responsiveness | `mms-ui-ux-design.mdc` | `mms-ui-ux-design` · `ui-ux-pro-max` · `mms-a11y-smoke` |
| Settings, navigation, i18n keys | `mms-settings-i18n.mdc` | `mms-settings-i18n` · `mms-i18n-completeness` |
| Reports, analytics, exports | `mms-reports.mdc` | `mms-reports-export` · `ui-ux-pro-max` |
| Messaging campaigns and logs | `mms-messaging.mdc` | `mms-messaging` |
| Performance, caching, virtualization | `mms-performance.mdc` | `mms-db-performance` · `mms-frontend` |
| Testing, logging, telemetry, resilience | `mms-testing-observability.mdc` | `mms-testing-e2e` · `mms-error-triage` |
| Local CI before push | `mms-completion-review.mdc` | `mms-code-review` |
| Ops, ports, health, CI, deploy | `mms-ops-infrastructure.mdc` | `mms-ops-deploy` · `mms-incident-response` · `mms-linux-compatibility` |
| Open migration debt | `mms-migration-status.mdc` | `mms-migration-fixes` · `mms-release-versioning` |
| Finance / accounting / ledger | `mms-data-layer.mdc` · `mms-api-interface.mdc` | `mms-finance-accounting` |
| Platform Apex console & administration | `mms-core.mdc` · `mms-auth-security.mdc` | `mms-platform-console` |
| Faculty hierarchy & staff appointments | `mms-data-layer.mdc` §1 · `mms-structure-naming.mdc` | `mms-faculty-domain` |
| Academic operations & student lifecycle | `mms-module-architecture.mdc` | `mms-student-lifecycle` |
| Realtime WebSocket events & cache invalidation | `mms-api-interface.mdc` · `mms-performance.mdc` §2 | `mms-realtime-events` |
| Custom CI ratchets & boundary diagnostics | `mms-completion-review.mdc` · `mms-agent-universal.mdc` | `mms-ci-ratchets` |
| Database seed fixtures & tenant resets | `mms-ops-infrastructure.mdc` · `mms-testing-observability.mdc` | `mms-seed-fixtures` |
| In-app notifications & alerts | `mms-ui-ux-design.mdc` §1 · `mms-api-interface.mdc` | `mms-notifications` · `mms-realtime-events` |
| Bulk CSV data import & onboarding | `mms-api-interface.mdc` §5 · `mms-data-layer.mdc` | `mms-data-import` · `mms-background-jobs` |
| Tenant user management & staff RBAC | `mms-auth-security.mdc` §2 · `mms-module-architecture.mdc` | `mms-user-management` · `mms-backend-security` |
| Agent standards corpus (rules/skills/mirrors) | `mms-agent-universal.mdc` · `mms-core.mdc` | `mms-agent-standards` |

## Enforcement registry (norm → how it is actually held)

A norm is either **machine-enforced** or explicitly **advisory** (`mms-agent-universal.mdc`).
Update this table in the same change that adds or removes a check.

| Norm | Enforced by | Kind |
|---|---|---|
| Cross-feature import boundary | `mms-boundary/no-cross-feature-imports` (ESLint, error) | lint |
| Physical directional CSS classes | `mms-bidi/no-physical-directional-classes` (ESLint, error) | lint |
| Surface/token misuse | `no-restricted-syntax` selectors (ESLint, warn — advisory until promoted) | lint |
| `any` in app/shared source | `@typescript-eslint/no-explicit-any` (ESLint, error — test files exempt) + `pnpm run check:code-norms` ratchet | lint + ratchet |
| Raw hex colours / file-size bands | `pnpm run check:code-norms` ratchet | ratchet |
| Wildcard DB projections | `pnpm run check:db-projections` (CI) | ratchet |
| Write-blocking index in a migration | `pnpm run check:migration-indexes` (CI) | ratchet |
| Applied migrations are immutable (forward-only DDL — new files allowed, edits/deletes fail) | `pnpm run check:migrations-forward-only` (CI `typecheck-lint` `--base HEAD^1` + pre-PR gate) | ratchet |
| Backend route→use-case→repository boundary (no direct `db/repositories` / `drizzle-orm` import from `routes/**`, static **or** dynamic) | `pnpm run check:backend-boundaries` (CI `typecheck-lint` + pre-PR gate) | ratchet |
| Canonical date/month schemas have a single definition (`isoDateSchema` / `monthKeySchema` / `billingPeriodSchema`; no re-declared canonical schema) | SSOT idiom guard inside `.agent/skills/mms-shared-package/scripts/check-shared-exports.sh`, via `pnpm run check:shared-purity` | ratchet |
| Bundle budget | `pnpm run check:bundle` (CI, build-dist job) | ratchet |
| i18n completeness across en/ar/ur/fa | `pnpm run check:i18n` (CI + pre-PR gate) — exits non-zero on any key missing or falling back to English | ratchet |
| Dependency advisories | `pnpm audit --audit-level=high` + dependency-review (CI) | CI |
| Secrets in history | gitleaks (CI, full history) | CI |
| Sensitive filenames never committed, at any path depth (`.env`, private keys, service-account JSON) | `sensitive-file-guard` CI job (`node scripts/check-staged-secrets.mjs --tracked`) | CI |
| Workflow security (SHA pinning, no credential persistence, no template injection, gated triggers) | `workflow-lint` job: actionlint + zizmor `min-severity: medium` (CI) | CI |
| Deployed bytes match CI's build of the commit | `actions/attest-build-provenance` in CI + `gh attestation verify` in `deploy.yml` | CI |
| Rule/skill/command/agent/mirror integrity (incl. `.agent/workflows` ↔ `.cursor/commands` ↔ `.claude/commands` ↔ `.claude/agents` parity) | `node scripts/verify-rules-integrity.mjs` + sync drift diff (CI) | CI |
| Local CI before commit (gates + path-aware unit tests) | `.githooks/pre-commit` (secrets + staged-file ESLint); `.githooks/pre-push` (blocks `main`, runs affected-only `pnpm ci:local` / `scripts/ci/local-ci.sh`) | hook + script |
| `drizzle-kit push` / destructive rm / .env reads | `.cursor/hooks/guard-shell.sh` (Claude + Cursor hooks) | hook |
| Tenant RLS enablement per table | `mms-schema-migrate/scripts/check-migrations.sh` | skill script |
| Faculty hierarchy, temporal primary integrity, and tenant isolation | `facultyAssignmentValidation.test.ts`, `facultyAppointmentsDb.integration.test.ts` | test |
| Faculty domain legacy surface (retired Teacher/FDA) + required schema | `pnpm run check:faculty-domain` (CI, `typecheck-lint`) | CI |
| `@mms/shared` runtime purity | `pnpm run check:shared-purity` (CI, `typecheck-lint`) | CI |
| a11y serious/critical violations | `e2e/tests/a11y/a11y-shell.spec.ts` (CI e2e job) | test |
| Platform UI ownership (native controls, duplicate exports/JSX, semantic palette classes) | `apps/frontend/src/platform/platformUiArchitecture.test.ts` | test |
| Coverage floors (FE 55/50, BE 45/27 lines/branches) | vitest thresholds in each workspace | test |
| Work directory convergence (selection SSOT, two-layer bulk chrome, no dead adapters) | `pnpm run check:work-directory` | ratchet |
| Data tables use `DataTable` / `WorkBatchTable` (no hand-rolled `<Table>` outside the report/ledger allowlist) | `pnpm run check:work-directory` | ratchet |
| Shared UI component governance (zero duplicate components across consoles, `@shared/ui` SSOT, zero orphaned imports) | `mms-shared-ui.mdc` (norm) + `pnpm run check:shared-ui` (CI + pre-PR gate) | rule + ratchet |
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
| WCAG AA a11y, logical CSS (Platform apex LTR-locked per `mms-settings-i18n.mdc` §5), touch targets | ✅ Yes |
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
| **Shared UI audit** — duplicate components, orphaned imports, `@shared/ui` SSOT, pre-deletion cleanup | **`mms-shared-ui`** (run `/shared-ui-audit` workflow) |
| Soft-delete / trash lifecycle / hard-purge | `mms-soft-delete` |
| Migration debt | `mms-migration-fixes` |
| PR / self-review | `mms-code-review` |
| Platform Apex console / administration | `mms-platform-console` |
| Faculty appointments / temporal exclusions | `mms-faculty-domain` |
| Student admissions / attendance / exams | `mms-student-lifecycle` |
| WebSocket `/api/ws` / realtime invalidation | `mms-realtime-events` |
| CI ratchets & boundary check diagnostics | `mms-ci-ratchets` |
| Database seed fixtures & demo resets | `mms-seed-fixtures` |
| In-app notifications & unread alerts | `mms-notifications` |
| Bulk CSV data import & onboarding | `mms-data-import` |
| Tenant users & staff role provisioning | `mms-user-management` |

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
- [ ] No new hardcoded labels/colours — see `mms-settings-i18n.mdc` (en/ar/ur/fa) + registries
- [ ] Module tiers respect isolation boundaries in `mms-module-architecture.mdc`
- [ ] Person-directory Work: `directoryViews: ['table','cards']` (never `list`) — `mms-module-architecture.mdc` §3
- [ ] Bulk PUT upsert / ban wipe-missing-rows — `mms-api-interface.mdc` §5; form close after `mutateAsync` — module-arch §7
- [ ] Write Zod `.strict()` — `mms-form-architecture.mdc`
- [ ] Work column widths persist (local + `/column-preferences`; merge preserves device widths) — `mms-module-architecture.mdc` §3
- [ ] Dashboard/report KPI cards use `/metrics` where available — `mms-reports.mdc`
- [ ] Setup Fields / form: tab enablement SSOT + enabled fields render in form **and** drawer — `mms-fields.mdc` / `mms-form-architecture.mdc`
- [ ] Shared logic in `@mms/shared` if cross-app or 2+ modules
- [ ] **Shared UI governance**: zero duplicate primitive files in `platform/` or `tenant/`; run `pnpm run check:shared-ui` to confirm no orphaned imports, cross-console leaks, or facade violations — `mms-dry.mdc` §1 · `mms-ui-ux-design.mdc` §1 · skill `mms-shared-ui`
- [ ] **Legacy UI cleanup**: if deleting component files, run `pnpm typecheck && pnpm --filter mms-frontend lint && pnpm --filter mms-frontend build` **before** deletion, and the same suite + `pnpm run check:shared-ui` **after** — `mms-dry.mdc` §4
- [ ] Touched app files stay under the hard 300 lines; splits keep public import barrels — `mms-structure-naming.mdc`
- [ ] No commit unless user requested
- [ ] Update **all mirrors** when changing standards: `bash .agent/scripts/sync-all.sh`
- [ ] Auth/write routes: `mms-auth-security.mdc` (do not OR entity write with `canEditSetup`)
- [ ] Backup/restore: admin + `canBulkSync`, safety backup + password step-up, sync timeout rollback, strip secrets / exclude credential tables — `mms-settings-i18n.mdc` / `mms-data-layer.mdc` / `mms-auth-security.mdc`
- [ ] Soft-delete: 3-tier indexes, partial unique indexes `WHERE deleted_at IS NULL`, URL sync `?view=trash`, 23505 conflict trap, session invalidation, outbox CDC — `mms-soft-delete`
- [ ] New UI: `mms-ui-ux-design.mdc` keyboard + labels + §4 responsive checklist (375 / 768 / 1440)
- [ ] New `@mms/shared` pure helpers: unit test per `mms-testing-observability.mdc`

## Removed / Merged (History)

| Removed | Merged into |
|---------|-------------|
| `antigravity-global.mdc` | Renamed & generalized to `mms-agent-universal.mdc` |
| `mms-ai-editing.mdc` | `mms-core` + `mms-agent-universal` |
| `mms-ops.mdc`, `mms-production-ports.mdc`, `mms-linux-compatibility.mdc`, `mms-ci.mdc`, `saas-architecture.mdc` | `mms-ops-infrastructure.mdc` |
| `mms-ui-visual.mdc`, `mms-ui-rendering.mdc`, `mms-ui-tabs.mdc`, `mms-ui-forms.mdc`, `mms-a11y.mdc` | `mms-ui-ux-design.mdc` |
| `mms-module-work.mdc`, `mms-module-setup.mdc`, `mms-module-isolation.mdc`, `mms-module-crosscutting.mdc`, `mms-background-jobs.mdc` | `mms-module-architecture.mdc` |
| `mms-shared-dry.mdc` | `mms-dry.mdc` |
| `mms-database.mdc`, `mms-query.mdc` | `mms-data-layer.mdc` |
| `mms-structure.mdc`, `mms-naming.mdc` | `mms-structure-naming.mdc` |
| `mms-auth.mdc`, `mms-rbac.mdc`, `mms-tenant.mdc`, `mms-security.mdc` | `mms-auth-security.mdc` |
| `mms-config.mdc`, `mms-settings-navigation.mdc`, `mms-i18n.mdc` | `mms-settings-i18n.mdc` |
| `mms-frontend.mdc`, `mms-backend.mdc` | `mms-api-interface.mdc` |
| `mms-contacts.mdc`, `mms-contact-link.mdc` | Completely Deleted |
| `mms-testing.mdc`, `mms-observability.mdc` | `mms-testing-observability.mdc` |

## Verify in Cursor

**Settings → Rules** — 1 always-apply rule (`mms-core`) + 21 scoped rules when matching paths are open (**22 total**).
