# checklist — mms-code-review

Extracted from `SKILL.md` so the skill body stays loadable in one pass; the owning rule is the norm SSOT.


## Checklist

### Architecture
- [ ] Shared types/utils in `@mms/shared` (not duplicated)
- [ ] No frontend → backend direct imports
- [ ] Backend: routes → use-cases (repo DI) → repository interface → adapter (no `pg`/Drizzle in routes); refactored modules use composition root (`contactUseCases` pattern) — `mms-api-interface.md` §2
- [ ] Repository interface is the sole storage gateway; use-case functions take it via DI (testable with fakes) — `mms-data-layer.md`
- [ ] Correct data layer: Query for REST resources, `useLiveCollection` for legacy modules
- [ ] Module config via `createStandardModuleConfigHook` (extend the hook, no forked providers) — `mms-hooks.md`
- [ ] Touched app files under hard ~300 lines (prefer ~220 FE shells); splits keep public barrels — `mms-structure-naming.md`

### Backend API
- [ ] Tenant protected routes use **`authenticateTenant`** — not raw `jwtVerify`
- [ ] Cookie CSRF / Origin on state-changing cookie-auth routes
- [ ] `host` / `x-forwarded-host` tested in `inject()` tests for tenant routes
- [ ] Module access gates: `registerModuleAccess` + `MODULE_ROUTE_ACTION_RULES` on every module endpoint; coverage verified via `moduleAccessCoverage.test.ts` — `mms-auth-security.md` §3
- [ ] Zod write DTOs (prefer `.strict()`); no parallel Ajv for same shape
- [ ] `rbacService` on writes; admin-only on sync download/upload
- [ ] Drizzle migration + journal via **`mms-schema-migrate`** (no `drizzle-kit push` on shared/prod)
- [ ] Stable error `type` codes; no stack traces in responses
- [ ] No banned Node 24 dependencies (`dotenv`, `axios`, `node-fetch`, `ws` for client, `glob`, `fast-glob`, `path-to-regexp`)
- [ ] Core module imports use `node:` prefix (`node:fs`, `node:crypto`, `node:path`, `node:async_hooks`)
- [ ] WHATWG `new URL()` used exclusively (no legacy `url.parse()`)
- [ ] Explicit Resource Management (`using` / `await using`) for database connections / transactions
- [ ] Single-shot hashing uses `crypto.hash()` from `node:crypto`
- [ ] Context propagation via `AsyncLocalStorage` (`node:async_hooks`; no experimental `AsyncContextFrame` flag)
- [ ] Zero wildcard DB projections (`SELECT *`), verified via `check:db-projections.mjs` — `mms-performance.md` §1
- [ ] Outbound fetch uses `AbortSignal.timeout()`, request `bodyLimit` enforced, and send idempotency digest bound to body — `mms-api-interface.md` §6

### Frontend API
- [ ] Internal MMS calls use `apiFetch` / `apiJson` — no raw `fetch('/api/...')`
- [ ] `credentials: 'include'` via apiClient (cookie session — no new `mms_token` writes)
- [ ] Module route access: `TENANT_APP_ROUTE_ACCESS` + `ModuleAccessRoute` gates; coverage verified via `routeAccess.test.ts` — `mms-auth-security.md` §3
- [ ] Concurrency & signals: pass `AbortSignal` into `apiFetch` and `queryFn`; combine signals via `AbortSignal.any()` — `mms-agent-universal.md` §3
- [ ] Query factories / tuple keys — skill **`mms-query-factories`**
- [ ] `enabled: isAuthenticated` on tenant REST hooks
- [ ] Mutations invalidate affected queries (list + count keys; Contacts also messaging resolve)
- [ ] Optimistic updates: banned for money, bulk, backup/restore, messaging send; eligible non-financial single-record soft-delete uses optimistic hide with 5–10s Undo toast (`docs/soft-delete.md` §7.8)
- [ ] No duplicate data path (Query mutations + parallel `saveCollection` for same write)
- [ ] After server `bulkSave` imports (e.g. Google sync), invalidate only — do not re-upsert the same rows
- [ ] REST pages use Query hooks / collection facades — not raw `useLiveCollection` for entity rows
- [ ] Report widgets/visualizer: `useWidgetCollections` / `useReportCollectionRows` — no `getCollection`/`saveCollection` primary for REST entities

### UI / config
- [ ] Code norms held: zero explicit `any` (`check:code-norms.mjs`), zero raw hex colours outside `@theme` (`check:code-norms.mjs`), zero Tailwind arbitrary-colour bracket expressions (`[#...]`), files kept under 300 LOC hard limit — `mms-dry.md` §4, `mms-ui-ux-design.md` §2, `mms-structure-naming.md` §3
- [ ] Work directory convergence: DataTable / WorkBatchTable stack reused; zero hand-rolled tables outside allowlist; viewMode SSOT (`check:work-directory.mjs`) — `mms-dry.md` §1, `mms-module-architecture.md` §3
- [ ] No hardcoded labels/colours/status maps — `t()` + registries
- [ ] No new `uiStrings` keys outside Contacts module
- [ ] Fields/tabs from config registries
- [ ] Module tier: `work` | `reports` | `setup` (applies to both tenant and platform modules)
- [ ] `ResponsiveAccordionTabs` / `SubTabBar` — no inline tab bars
- [ ] Mobile-first layout: no fixed `w-[Npx]` page widths; no `max-lg:` layout forks; logical CSS for RTL
- [ ] Tables wrapped (`Table` or `overflow-x-auto`); interactive controls ≥ 44×44 (`min-h-11 min-w-11`)
- [ ] Forms: `FormModal` + norms — skill **`mms-form-architecture`** (container queries, ContactConfig options, collection delete persist)
- [ ] Bulk id bodies / contacts list filters: shared schemas (`bulkIdsBodySchema`, `contactsListQuerySchema`) — no forked Messaging flags
- [ ] Contacts `activeCount` = soft-delete-filtered total (not phantom `isActive`)
- [ ] Settings: draft hooks + preview — skill **`mms-settings-i18n`** / **`mms-frontend`**
- [ ] UI/UX Pro Max alignment on coding and review (`mms-ui-ux-design.md` §8, skill `ui-ux-pro-max`): semantic tokens (no raw hex/brackets), BiDi logical CSS, touch targets ≥ 44×44px, text-wrap: balance on headings, chip/tag wrapping, table overflow wrapping, 150-300ms transitions respecting prefers-reduced-motion
- [ ] **Platform apex English-only** (`mms-settings-i18n.md`) / **missing tenant hard-redirect** (`mms-auth-security.md`)

### RBAC (frontend)
- [ ] Module pages use `useModulePermissions(X_MODULE_MANIFEST)` (or `can()`) — not `role ===` / `disabled={role === '…'}`
- [ ] Forbidden actions omitted — not disabled placeholders

### Soft delete (when entity supports it)
- [ ] Dedicated `<module>SoftDeleteRoutes.ts` plugin isolates soft-delete and bulk trash endpoints (`mms-api-interface.md` §7)
- [ ] `DELETE` soft-deletes; `POST :id/restore` restores (atomic conditional latch `WHERE deleted_at IS NULL RETURNING id`)
- [ ] Single restore wired via `registerResourceRoutes`: `buildRestoreResponse` sanitizes attributes (`sanitizeOneForUser`), `mapRestoreError` maps domain uniqueness validation to HTTP 400 (`validation_error`), and race-condition PostgreSQL `23505` maps to `409 Conflict`
- [ ] Bulk operations wired via `registerSoftDeletableBulkTrashRoutes` with `bulkIdsBodySchema` (500 max cap) and transactional audit hooks (`onAfterBulkDelete` with reason, `onAfterBulkRestore`)
- [ ] Single-record `GET /:id` returns `404` for archived rows unless `?includeDeleted=true` is authorized with `canDelete`
- [ ] Batched single-statement SQL for bulk delete/restore (`WHERE id IN (...) AND deleted_at IS NULL` — no per-row loops)
- [ ] List supports `includeDeleted`; Work default excludes deleted; BE SQL-filters `deleted_at` via dynamic AST (no parameterized booleans)
- [ ] Relational child queries in `with: { ... }` explicitly filter `where: (c, { isNull }) => isNull(c.deletedAt)`
- [ ] Partial unique indexes (`WHERE deleted_at IS NULL`) used for recyclable keys (email, phone, employee_id) — assess actual NULL semantics; financial source identities may need lifetime uniqueness (advisory)
- [ ] Session invalidation on user/faculty soft delete + auth resolvers gate on `deleted_at IS NULL`
- [ ] Active foreign key guarding: write schemas reject references to soft-deleted records
- [ ] Create/update write schemas strip client soft-delete fields
- [ ] FE trash UI: URL param sync (`?view=trash`), filter state preserved on toggle, eligible non-financial optimistic 5–10s Undo toast, drawer `ArchivedBanner` (`WarningCallout`) with single restore
- [ ] Soft-delete modules: trash toggle + restore omit Add/messaging/exports in archive mode
- [ ] Work multi-select uses `BulkSelectionBar` + `BulkSelectionActions` (`BulkSelectionDeleteAction` / `BulkSelectionRestoreAction` / Messaging) on list/parent (no forked selection chrome; no toolbar-inline trash)
- [ ] Entity merge (if any) is atomic server endpoint with foreign key reparenting in a transaction — not FE dual-write
- [ ] Outbox CDC events emitted with monotonic versioning (`entity.soft_deleted`, `entity.restored`)

### Gold-standard module parity (`mms-module-architecture.md` §7)
- [ ] Bulk PUT upsert-only — no `replaceForWorkspace` / wipe-missing-rows (incl. custom-tabs) on API write paths
- [ ] Forms/setup use `mutateAsync` / await; close only after success
- [ ] Manifest `setupSubTabs` + `softDelete` metadata when applicable
- [ ] Setup gated by `canEditSetup` (or `platformUserCan`); Work shows `ErrorState` on list failure **with hint** (`loadFailedHint` — tenant and platform apex)
- [ ] Directory empties use `EmptyState` (`title` required; `compact` when dense); column gates use `isColumnVisible` (not `show*` fans)
- [ ] Cmd/Ctrl+N create when `canWrite` (or `platformUserCan`) and not in trash
- [ ] Prefer shared Work chrome (`EmptyState` / `FieldErrorMessage` / `WarningCallout` / `BulkSelectionBar` / `WORK_SURFACE` / `FORM_CARD` / `ModuleCommandMetricsGrid` for KPI strips; person-module chrome: `LeadingIconInput`, `DetailSectionTitle`, `FormFooterChip`, `ModuleFilterDropdown`, `DrawerSyncStatusFooter`; `h-chart-*` / `z-modal*` / `max-w-toast` over ad-hoc sizes) — `mms-ui-ux-design.md`
- [ ] UI/UX Pro Max design intelligence alignment (`mms-ui-ux-design.md` §8): semantic HSL token mapping, resilient text layout (`text-wrap: balance`), compact density, state preservation

### Messaging (when touched)
- [ ] Composer uses `MessagingRecipient` — not contacts schemas
- [ ] Clear-logs soft-archive semantics preserved
- [ ] Session-forced `userId` on BE; no SQL echo; upsert templates/logs
- [ ] Send/campaign idempotency key **bound to body digest** (409 on mismatch); `429`/`Retry-After` surfaced

### Field persistence (new/changed fields)
- [ ] Field on `@mms/shared` type + `DEFAULT_*` + merge helper
- [ ] Write reaches PostgreSQL
- [ ] UI control bound to save path — not orphaned `useState`

### Auth / security
- [ ] No secrets in diff
- [ ] OTP uses `crypto.randomInt()` — not `Math.random()`
- [ ] Rate limit preserved on login/onboard/messaging send when touching those paths
- [ ] No in-memory auth handoff / 2FA maps — use `auth_artifacts`
- [ ] Never trust client tenant/userId for authz
- [ ] `ContactConfigProvider` not nested on child pages

### Audit trail & immutability (when touched)
- [ ] 5-dimension payload (Who, What, When, Why, Integrity) populated
- [ ] RFC 8785 Canonical JSON (JCS) used for delta and hash computation
- [ ] W3C `traceparent` extracted and recorded as `correlationId`
- [ ] Minimization: non-essential PII and secrets stripped from old/new state
- [ ] Atomically written in transactional outbox (`withTenant`)
- [ ] Sharded hash chains (no global serial chain contention); Merkle root rollups
- [ ] Right-to-erasure: crypto-shredding (destroy key) or redact-and-append (`action_type = 'REDACT'`); no historical row deletion or hash recomputation
- [ ] Database permissions: `INSERT`-only for app user; `UPDATE`/`DELETE` revoked
- [ ] Access to audit records logged as auditable event (`action_type = 'VIEW'`)

### Testing
- [ ] Strict TDD verification: targeted Vitest spec written first, with the Red-phase command + failure in the PR body — `mms-tdd.md` §1–§2 (`pnpm run check:tdd-pairing` advisory)
- [ ] New `@mms/shared` pure helpers have unit tests
- [ ] Specification naming: tests follow `describe('Entity', () => it('given [condition], should [expected result] when [action]'))` — `mms-testing-observability.md` §2
- [ ] AAA format: tests distinctly separate `// Arrange`, `// Act`, and `// Assert` phases — `mms-testing-observability.md` §2
- [ ] User-centric queries & black-box boundary: DOM/E2E tests use `getByRole` > `getByLabelText` > `getByText`; no assertions on component internal state or CSS classes — `mms-testing-observability.md` §3
- [ ] Realistic interactions: use `userEvent` over `fireEvent` in component tests; web-first locator actions in Playwright — `mms-testing-observability.md` §3
- [ ] Transport-level mocking: Fastify `inject()` on backend; no monkey-patching raw `fetch` or internal client classes — `mms-testing-observability.md` §4
- [ ] Typed factories over JSON: domain models constructed via typed factory builders with `@mms/shared` defaults; ban static mutable `.json` fixtures — `mms-testing-observability.md` §4
- [ ] Zero shared mutable state: no outer `describe` mutable `let`s; mandatory lifecycle resets; no arbitrary `sleep`/`waitForTimeout` — `mms-testing-observability.md` §4
- [ ] Strict assertion specificity: ban `toBeTruthy()`, `toBeFalsy()`, generic `toBeDefined()`; use strict types, ISO regex (`/^\d{4}-\d{2}-\d{2}T/`), or typed DOM instances (`toBeInstanceOf(...)`) — `mms-testing-observability.md` §1
- [ ] Zero DB skip latches: ban `isDbAvailable`; ordinary integration tests use in-memory repository mock fixtures and Fastify `inject()`; explicit PostgreSQL `test:db` must actually execute for locking/RLS evidence — `mms-testing-observability.md` §1
- [ ] Multi-tenant integration & RLS: live DB tests verify cross-tenant isolation (Tenant A cannot read/mutate/delete Tenant B data) and transactional rollback on write failure — `mms-testing-observability.md` §12
- [ ] Negative tests spy on `console.error` / `console.warn` for silent test output
- [ ] Auth/RBAC/tenant changes have `inject()` allow+deny tests
- [ ] Coverage ratchet: no configured floor in any `vitest.config.ts` was lowered and new code is covered at the touched surface's measured level; raise a floor only with a green measured value — `mms-testing-observability.md` §5
- [ ] Shell / touch / RTL / table changes: keep `responsive-shell` + `responsive-authenticated` green; extend when touching platform `md` nav or Reports/Setup builders
- [ ] Adversarial Loophole Audit deliverable: PR or completion summary provides the 3-part markdown audit report — `mms-completion-review.md` §4

### Accessibility
- [ ] When shells/primitives/FormModal change → run skill **`mms-a11y-smoke`** (axe serious/critical + focus-return)
- [ ] Icon buttons `aria-label` from `t()`; Suspense `role="status"`; honor `prefers-reduced-motion`
- [ ] Form controls use `useId()` for accessible control/label association

### Performance / deps / React 19 / Runtime
- [ ] Export artifacts generated via backend BullMQ + Typst/ExcelJS; no client-side DOM canvas/jspdf injection
- [ ] Targeted memoization: memoize non-trivial calculations (`useMemo`) and callback/object references passed to dependencies or memoized components (`useCallback`) to avoid render churn; avoid premature memoization on primitives — `mms-performance.md`
- [ ] React 19: native `ref` as prop (ban `forwardRef` in newly authored components); leverage `startTransition`, `useDeferredValue`, and `useEffectEvent` alongside targeted memoization — `mms-performance.md`
- [ ] Zero non-erasable TypeScript syntax (`enum`, `namespace`, constructor parameter properties) for Node 24 native type stripping (`--experimental-strip-types`) — `mms-dependencies.md`
- [ ] Native ECMAScript non-mutating methods (`toSorted()`, `toReversed()`, `toSpliced()`, `with()`, `Object.groupBy()`)
- [ ] Zero queries inside loops (N+1); batch via Drizzle relational `with`, `inArray` ($\le 500$), SQL joins, or `/resolve` — `mms-performance.md`
- [ ] Zero wildcard projections (`SELECT *` or bare `db.select().from(table)`); use explicit column projection objects matching Response DTOs — `mms-performance.md`
- [ ] Virtualize DOM lists, tables, and feeds > 30 items with `@tanstack/react-virtual` — `mms-performance.md`
- [ ] Large uploads stream via `@fastify/multipart`; large exports stream via `node:stream` / async generators; datasets $> 500$ rows offloaded to background jobs — `mms-performance.md`
- [ ] Redis caching: tenant-scoped key `mms:{tenantId}:{module}:{resource}:{hash}`; mutations trigger write invalidation — `mms-performance.md`
- [ ] Performance refactor documentation: baseline bottleneck + quantified resource saved (CPU/RAM/DB/Bundle) — `mms-performance.md`
- [ ] Dependency bumps → skill **`mms-dependency-upgrade`**

### Scope
- [ ] No drive-by refactors
- [ ] No unused imports in changed files

## Accounting review (advisory)

Use the [financial verification matrix](../../mms-finance-accounting/references/verification.md). Distinguish posted-entry corrections from draft CRUD, test every posting writer, and trace report consumers and close/retry races. Record missing controls rather than imply compliance.
