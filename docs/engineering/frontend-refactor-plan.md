# Frontend Architecture Audit and Refactoring Plan

Date: 2026-09-28
Status: Slices A1–A7 and Phase 6 production build and test suites complete. See implementation backlog.

Continuation: see the [current evidence and implementation backlog](frontend-refactor-backlog.md).
The follow-up inspection found an existing UI boundary guard and shared command-palette
infrastructure. The backlog supersedes assumptions below about creating those from scratch.

## 1. Outcome and scope

Build on the existing design system so platform and tenant experiences share rendering,
interaction contracts, and semantic tokens while their adapters own domain policy.
Optimize for consistent behavior and safe changes, rather than the largest possible shared component.

Scope: `apps/frontend/src`, frontend consumption of `packages/shared`, related tests,
architecture checks, and documentation. Backend behavior and deployment are outside this refactor.
Tenant customization is treated as runtime branding, locale, capabilities, and module configuration;
the initial inspection found a shared tenant application, rather than separate tenant codebases.
Phase 0 will verify whether any additional tenant-specific extension mechanisms exist.

## 2. Evidence from the initial inspection

These are sampled observations, not a completed repository-wide audit or fresh test results.

| Observation | Code evidence | Planning consequence |
| --- | --- | --- |
| Platform and tenant already compose one shell | `components/common/AppShell.tsx`, `platform/components/PlatformPageShell.tsx`, `tenant/components/layout/AppLayout.tsx` | Extend current slots; do not build another universal shell. |
| Shell accepts both an adapter object and individual slots, with adapter precedence | `components/common/AppShell.tsx` | Inventory consumers, then choose one canonical API with a temporary compatibility path. |
| Shared UI still imports tenant orchestration | `components/ui/BackgroundJobsTray.tsx`, `useDatePickerState.ts`, `TemplateEditor.tsx`, `messageComposer/useMessageComposerDispatch.ts` | Separate views from tenant controllers incrementally. |
| Several shared UI paths are compatibility exports of tenant code | `components/ui/RegistryPersonSelect.tsx`, `UserActorSelect.tsx`, `reports/*` | Distinguish import aliases from actual reusable components; track transitive dependencies. |
| Token generation and DOM application already have separate owners | `index.css`, `lib/brandingThemeCore.ts`, shared `buildBrandingCssVariables` | Preserve HSL semantics and extend existing owners. |
| Query persistence starts from the shared query client; persister has a default cache key | `lib/queryClient.ts`, `lib/query/idbCachePersister.ts` | Trace auth lifecycle, restore timing, origin boundaries, and identity changes before proposing changes. This alone does not prove a data leak. |
| Prior consolidation has already happened | `docs/architecture/frontend-reuse-audit.md`, work-directory design and existing checks | Revalidate old findings; avoid repeating completed navigation, accent, or selection work. |

Use the existing [reuse audit](frontend-reuse-audit.md), [architecture audit](../frontend-architecture-audit.md),
[ADR 0001](../adr/0001-shared-package-and-dry-reuse.md), and
[work-directory design](../superpowers/specs/2026-09-24-work-directory-convergence-design.md)
as historical context. Their counts and verification results are not a current baseline.

## 3. Target ownership and dependency direction

| Layer | Owns | Must not own |
| --- | --- | --- |
| `packages/shared` | Pure domain types, DTO schemas, manifests, pure branding calculations | React, DOM effects, transport, identity state |
| `index.css` and semantic style helpers | Semantic token mappings, layout scales, component variants | Per-tenant hardcoded styling branches |
| `components/ui` | Domain-independent primitives and interaction views | Tenant/platform services, feature imports, endpoint selection |
| `components/common` | Shared compositions such as shell and module scaffold | Hidden tenant data loading or permission policy |
| Shared hooks and `lib` | Reusable interaction transitions, transport primitives, query utilities | Implicit tenant identity or feature-specific default behavior |
| Platform/tenant adapters | Authentication context, capabilities, locale resolution, queries, persistence policy | Forked copies of shared visual primitives |
| Feature controllers and pages | Domain workflows, query-to-view mapping, slots and actions | Independent copies of shared selection or UI state contracts |

Dependency direction: host/feature adapters → shared compositions → UI primitives.
Frontend layers consume pure shared contracts. Shared rendering never imports back into host features.
Start within the current frontend workspace. Consider a separate UI package only if an independently
built second consumer creates a concrete packaging need; keep React out of `@mms/shared`.

### Composition and component APIs

- Use typed props for data and explicit callbacks for actions; use slots for variable content.
- Keep endpoint selection, tenant identity, permission evaluation, and module policy in adapters.
- Pass resolved capabilities/actions into views; frontend visibility never replaces server authorization.
- Prefer explicit state variants where combinations matter, such as loading, initial error, empty,
  ready, and ready-with-refresh-error. Do not erase useful stale data during background failures.
- Use controlled state where page, table, cards, and bulk actions share ownership.
- Keep small domain wrappers when they translate policy into shared props. Similar markup alone
  is insufficient evidence that two workflows should have one controller.
- Avoid `isPlatform`, tenant-name checks, or expanding boolean option sets in shared views.
- Share locale/formatting infrastructure where appropriate; resolve platform English/LTR and tenant
  language in host adapters. Do not require every primitive to accept an entire application context.

### State SSOT

| State category | Authority | Audit focus |
| --- | --- | --- |
| Server entities | Shared DTOs plus domain query factories | Keys, mutation invalidation, WebSocket invalidation, cancellation |
| Route-addressable filters | Existing URL contract where applicable | One serializer/parser; explicit precedence over saved defaults |
| Selection and directory interaction | Page controller using shared interaction hooks | Table/card/bulk parity; reset and pagination semantics |
| Form drafts | Form controller | Reset on record change; save success/failure behavior |
| User preferences | Existing settings service, with explicit local persistence policy | Scoped keys, defaults, reconciliation, unavailable storage |
| Branding and locale | Resolved host settings | Preview versus saved values; cleanup on lifecycle changes |
| Authentication | Existing host-specific auth providers | Cache lifecycle and isolation; no shared UI auth decisions |

## 4. Ordered implementation phases

### Phase 0 — Complete the audit and establish a baseline

1. Inventory routes, providers, primitives, compositions, feature adapters, query factories,
   registries, token consumers, and tests across platform and tenant trees.
2. Produce an import graph covering aliases, barrels, re-exports, dynamic imports, and type imports.
   Classify shared-to-domain dependencies as runtime coupling, type coupling, or compatibility exports.
3. Group duplicate candidates by behavior: navigation, command palettes, selectors, forms,
   directory chrome, report rendering, empty/error states, and mutation feedback.
4. Trace token definitions through branding previews, persisted settings, charts, print/export,
   component variants, dark mode, and language-aware font application.
5. Trace query keys, identity scope, cache hydration/purge, invalidation, and URL/local state ownership.
6. Reconcile every previous audit finding as resolved, still present, changed, or unverified.
7. Record baseline typecheck, lint, relevant unit tests, code-norm and directory checks, production
   bundle sizes, and representative authenticated UI behavior using disposable test data.

Deliverable: evidence ledger with file references, consumers, risk, proposed owner, migration size,
tests, and priority. Separate existing failures from regressions. Review E2E setup before execution
because existing bootstrap procedures may reset platform users.

Exit: each planned extraction has real consumers and a behavior contract; all high-risk uncertainties
have a test or investigation task. Avoid promising an exhaustive completion date before this inventory.

### Phase 1 — Define contracts and prevent new boundary debt

1. Document existing public contracts for shell slots, selectors, directory state, asynchronous
   states, actions, and theme application. Narrow only where callers support the narrower contract.
2. Extend the existing `no-ui-host-imports` check and its exact baseline exceptions, documenting
   rationale and intended migration phase. Preserve rejection of new edges and stale exceptions.
3. Expand its fixtures and inspect indirect imports through shared barrels/helpers; its current
   direct-import checks do not establish transitive independence.
4. Reuse existing code-norm, BiDi, work-directory, and shared-purity checks rather than duplicating them.

Exit: new boundary violations are detectable, and migration can proceed without breaking every
legacy import at once. Proposed new rules remain advisory until their checks are integrated.

### Phase 2 — Pilot presentation/controller separation

1. Inspect `useDatePickerState` and its global-settings consumers as the first bounded pilot.
   Supply resolved calendar/locale settings through an adapter while preserving current input behavior.
2. First repair the shared command-palette result/keyboard contract identified in the backlog.
   Both hosts already use `CommandPaletteModal` and `useCommandPaletteSearch`; retain their adapters.
3. Define one view API, migrate real callers, and test loading/error/empty, keyboard, and controlled
   state behavior. Confirm the view renders without tenant/auth providers.
4. Keep compatibility exports while callers migrate; record remaining callers explicitly.

Exit: at least one component is exercised by both host adapters with the same rendering contract,
and extracted UI has no runtime dependency on tenant or platform services.

### Phase 3 — Consolidate token ownership and branding application

1. Reconcile `index.css`, `formStyles`, semantic tones, accent mappings, chart palettes, and print tokens.
2. Derive repeated values from existing owners; retain intentional medium-specific output differences.
3. Restrict branding overrides to supported token inputs, preserving HSL channel expectations.
4. Verify saved/preview/cancel flows, light/dark/system mode, invalid branding fallbacks, token cleanup,
   and real Arabic/Urdu/Persian font behavior. Test simultaneous preview surfaces if supported.

Exit: migrated tokens have one definition or derivation path; no ad-hoc tenant palette branches;
visual and contrast checks cover representative valid branding values.

### Phase 4 — Consolidate state and data contracts

1. Audit query factories and existing `createModuleQueryInvalidator`; unify repeated behavior while
   retaining endpoint-specific keys and domain invalidation requirements.
2. Verify cache scoping and lifecycle across logout/login, permission changes, tenant context changes,
   and persisted restore. Account for browser origin isolation before changing the cache design.
3. Fix demonstrated lifecycle gaps with regression tests. Coordinate query-key changes with persistence
   versioning/clearing so old cached data cannot be interpreted under a new contract.
4. Recheck directory selection convergence; migrate remaining drift without reopening completed work.
5. Derive duplicate DTOs/constants from shared schemas only when they represent the same domain concept.

Exit: mutation and live-update paths invalidate the same intended data; relevant identity transitions
cannot show another session's cached records; each migrated UI state has one owner.

### Phase 5 — Expand by component family

Migrate in bounded slices: selectors → background-job views → message composer presentation → report
rendering → remaining confirmed duplicate chrome. Reorder based on Phase 0 risk and consumer counts.
For each family: characterize behavior, extract the view, retain domain controllers, migrate consumers,
test both host contexts where applicable, then reduce boundary exceptions.
Do not force tenant-specific workflows into platform usage just to increase reuse counts.

Exit: migrated shared surfaces are domain-independent; all compatibility paths have a consumer count
and retirement decision. File removal requires the repository's explicit deletion authorization.

### Phase 6 — Regression review and adoption documentation

1. Run repository typecheck, frontend lint/tests, relevant shared tests, existing architecture ratchets,
   production build, and bundle-budget checks against the Phase 0 baseline.
2. Run targeted platform/tenant lifecycle tests and responsive/axe suites for affected authenticated
   surfaces at 375, 768, and 1440 pixels; include actual tenant locales, keyboard and focus restoration.
3. Check table/card selection, filters, pagination, large-list virtualization, drawer/form interactions,
   denied actions, errors, offline recovery, and branding changes in representative workflows.
4. Update existing architecture documentation with final ownership, examples, unresolved debt,
   measured results, and migration guidance; link to owning rules rather than copying them.

Exit: agreed acceptance criteria pass, unresolved pre-existing issues are recorded, and no new
boundary exceptions or bundle-budget regressions remain unexplained.

## 5. Delivery, compatibility, and success measures

Each implementation slice should contain one coherent behavior change, its adapters, affected callers,
and meaningful regression coverage. Keep old public imports temporarily where needed. Revert a slice
as a unit if its behavior fails; avoid long-lived duplicate controllers and bidirectional state syncing.
Do not introduce new dependencies or a general plugin framework without evidence from real consumers.

Track: shared-to-domain import edges; compatibility-export callers; confirmed duplicate implementations;
token ownership exceptions; independently duplicated state owners; regression coverage; build sizes.
Set numeric baselines in Phase 0. Target zero forbidden edges in migrated families and no increase
elsewhere, rather than an arbitrary repository-wide reuse percentage.

Repository gates: `pnpm typecheck`, `pnpm --filter mms-frontend lint`, scoped/full frontend tests as
appropriate, `pnpm check:code-norms`, `pnpm check:work-directory`, and build plus `pnpm check:bundle`.
Use `pnpm check:i18n` as a report, not proof of translation correctness. Verify exact test selection
against affected files; public-route responsive tests alone do not validate authenticated shells.

Changes to protected CI/root configuration need explicit authorization under the repository rules.
Prepare check implementations and local evidence before requesting any necessary protected integration.
If standards change, edit canonical files, sync mirrors, and run the rules-integrity verifier.
Application implementation begins after this planning step; no staging, commits, or pushes are included.
