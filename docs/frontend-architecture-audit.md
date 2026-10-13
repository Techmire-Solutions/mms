# MMS Frontend Architecture Audit — Reuse, SSOT & DRY

**Scope:** `apps/frontend/src/**` (platform apex + tenant host), its consumption of
`packages/shared`, and the enforcement tooling (`scripts/check-code-norms.mjs`,
`apps/frontend/eslint-rules/`). React 19 + Vite 8, TanStack Query v5, Tailwind v4.

**Method:** Structural audit against three objectives: (1) maximize shared UI reuse
across platform and tenants, (2) enforce SSOT for design tokens, state contracts, and
component APIs, (3) DRY via composition/inversion-of-control over multi-conditional
tenant logic. Measured against **ADR 014** (`docs/adr/014-shared-package-and-dry-reuse.md`),
which already mandates both `@mms/shared` as SSOT and platform reuse of
`src/components/**` — this audit is largely a compliance review of that ADR.

**Overall finding:** the architecture is already mature and ADR 0001 is mostly
honored — tokens are centralized in one `@theme` block with semantic helpers, DTOs and
Zod schemas are centralized in `@mms/shared` (520 frontend import sites; 566 backend
files), module manifests drive `standardModuleConfigRegistry`, and the legacy document
store is contained to 3 files. The remaining debt is concentrated in four places:
**duplicate domain constants in `lib/data`**, a **partially adopted query-invalidation
contract**, **parallel platform/tenant chrome** (command palettes, sidebars, nav
models), and **near-duplicate `components/ui` pairs** with incompatible APIs.

---

## Scorecard

| Pillar | Grade | Evidence |
|---|---|---|
| Design-token SSOT | A− | Single `@theme inline` block (`apps/frontend/src/index.css:9`), `semanticTone.ts` + `formStyles.ts` helpers, hex-literal ban enforced; 2 source files still use raw palette utilities, and palette classes are not lint-banned |
| State contracts SSOT | B+ | Module manifests/settings 100% from `@mms/shared` (`apps/frontend/src/hooks/standardModuleConfigRegistry.ts:1-46`); but 148 raw `invalidateQueries` call sites vs 4 users of the invalidation factory |
| DTO/schema SSOT | A− | Zero `z.object` in frontend app code; shared consumed pervasively; a few local response-envelope types and duplicated constant arrays remain |
| Component reuse | B | Strong `components/ui` design system (~180 files) and descriptor architecture; but duplicated command palettes, sidebar/nav chrome, and pagination/toolbar pairs |
| Composition over conditionals | A− | Host branching contained to 9 files (`useIsTenantHost`); `components/entry` primitives already shared by both auth layouts; bulk-action adapters are manifest-driven |

---

## Findings (SSOT gaps first, per priority)

### P1 — State-contract & shared-package SSOT gaps

#### F1. Duplicate domain constant arrays between `lib/data` and `@mms/shared`

`apps/frontend/src/lib/data/accountingData.ts:1` declares
`ACCOUNT_TYPES = ["Asset", "Liability", "Equity", "Revenue", "Expense"]` and
`ACCOUNT_SUBTYPES`, while `packages/shared/src/accountingListQuery.ts:6` independently
declares `ACCOUNTING_ACCOUNT_TYPES` with identical values. Same pattern in
`apps/frontend/src/lib/data/financeData.ts:12-13` (`PAYMENT_METHODS`, `INVOICE_STATUSES`)
vs `packages/shared/src/financeModuleManifest.ts:113-114` (`OPEN_INVOICE_STATUSES`,
already consumed by the backend at `apps/backend/src/db/repositories/financeRepositoryList.ts:5`).

- **Risk:** silent drift — e.g. a new account type added to the shared Zod enum passes
  backend validation but is absent from the frontend's subtype map, or vice versa.
- **Fix:** delete the local declarations; re-export the shared constants from
  `lib/data` (or import directly) and extend shared where a frontend-only superset is
  genuinely needed. Severity **P1**, effort **S**.

#### F2. Query-invalidation contract only partially adopted

`apps/frontend/src/lib/query/createModuleQueryInvalidator.ts:12-25` defines the
canonical six-key invalidation contract (list/count/metrics/widgetAggregates/
preferences/lookups), but only **4 files** use it, while **148** raw
`queryClient.invalidateQueries` call sites exist outside `lib/query/` (plus 89
distinct `*_QUERY_KEY` constants declared across features).

- **Risk:** a new consumer (e.g. WebSocket live-push in
  `apps/frontend/src/lib/tenantWebSocket.ts`) invalidates a different key set than a
  module's own mutations, causing stale reads; renames touch dozens of call sites.
- **Fix:** migrate each module to `createModuleQueryInvalidator` (keys declared once
  next to the query factory), then ratchet raw `invalidateQueries` outside
  `lib/query/` and `tenant/hooks/collections/` in `scripts/check-code-norms.mjs`.
  Severity **P1**, effort **M** (mechanical, module by module).

#### F3. Frontend-local API response-envelope types

Response shapes that cross the network are declared locally instead of in
`@mms/shared`: `AuditListResponse`/`AuditVerificationResult`/`AuditExportPayload`
(`apps/frontend/src/tenant/hooks/collections/audit.ts:24-57`),
`AttachmentUploadResponse` (`apps/frontend/src/lib/attachmentUpload.ts:3`),
`ImageUploadResponse` (`apps/frontend/src/lib/imageUpload.ts:11`).
The audit ones at least compose shared entity types (`ModernAuditEvent`), so drift is
limited to the envelope.

- **Fix:** move envelope types into `@mms/shared` next to their entity schemas
  (`auditTypes.ts` already exports `ListAuditEventsQuery` at line 269 — the response
  side is missing). Severity **P2**, effort **S**.

#### F4. `lib/data/*Data.ts` is a mixed shim/logic layer with 153 import sites

Some files are pure re-export shims (`studentsData.ts`, 4 lines), others mix
re-exports with UI-coupled domain metadata (`accountingData.ts`, 278 lines, incl.
`ACCOUNT_TYPE_META` carrying Tailwind classes and emoji icons). 153 import sites go
through this indirection instead of `@mms/shared` directly.

- **Fix:** keep `lib/data` for genuinely frontend-only view models; move pure domain
  constants to `@mms/shared` (F1) and split UI metadata (icons/colors) into the module
  manifest or a `components/ui` accent helper (cf. `directoryCardAccent.ts`).
  Severity **P2**, effort **M**.

### P2 — Component reuse & DRY

#### F5. Two parallel command-palette implementations

`apps/frontend/src/components/ui/CommandPalette.tsx` (178 LOC) and
`apps/frontend/src/platform/components/PlatformCommandPalette.tsx` (170 LOC)
reimplement the same overlay: query state, `selectedIndex` keyboard navigation,
framer-motion backdrop (`OVERLAY_BACKDROP` from `formStyles`), and `Input` chrome.
They differ only in item source (`commandPaletteItems.ts`, 205 LOC vs
`platformCommandItems.ts`, 133 LOC) and results rendering.

- **Fix:** extract a headless `CommandPaletteShell` (open/query/selection/render
  props) into `components/ui`; both hosts inject an items provider and a result-row
  renderer. Mirrors the pattern that already works for auth pages — both
  `PlatformAuthLayout` and tenant `AuthLayout` already compose
  `@/components/entry` primitives. Severity **P2**, effort **M**.

#### F6. Parallel sidebar/nav chrome and two nav models

Platform: `PlatformSidebar.tsx` (175 LOC) + `sidebar/PlatformSidebarBrand.tsx` (76) +
`sidebar/PlatformSidebarFooter.tsx` (96) + `PlatformSidebarNav.tsx`, driven by
`platform/lib/platformNav.ts` (97 LOC, `PlatformNavSection`/`PlatformNavItem`).
Tenant: `layout/Sidebar.tsx` (55) + `SidebarNav.tsx` (136) + `SidebarBrand.tsx` (59) +
`MobileSidebar.tsx` (156) + `MobileSidebarNavItems.tsx` (142), driven by
`lib/config/navConfig.tsx` (177 LOC, `NavItem`/`NavSubItem`). Both nav trees already
reuse the shared `SidebarNavItem` leaf (per ADR 0001), but the containers, collapse
behavior, mobile drawers, and brand blocks are forked.

- **Fix:** one `AppSidebar` shell in `components/common` parameterized by a nav-model
  interface (`sections → items → {icon,label,route,visible}`), an adapter per host
  (`platformNavAdapter`, `tenantNavAdapter`), and injected brand/footer slots. This is
  inversion of control replacing two hand-maintained trees. Severity **P2**,
  effort **L** — schedule after F5; keep `PlatformSidebarContext` as the platform
  adapter's state source.

#### F7. Two pagination components with incompatible APIs

`SimplePagination.tsx` (`{currentPage, totalPages, onPageChange}`, 4 consumers —
dashboard widgets) vs `ListPagination.tsx` (`{page, total, limit, hasMore,
i18nNamespace, variant}`, 4 consumers — module lists). Same chevron UX, different
contracts; `ListPagination` additionally re-implements page-clamping math.

- **Fix:** make `ListPagination` the single component (it owns i18n + total/limit
  semantics); add a `hideWhenSinglePage` prop to absorb `SimplePagination`'s early
  return; migrate the 4 widget call sites. Severity **P3**, effort **S**.

#### F8. `ExportToolbar` (18 consumers) vs `ExportToolbarCompact` (2 consumers)

Same export affordance in two densities with separate prop interfaces
(`ExportToolbar.tsx:17`, `ExportToolbarCompact.tsx:6`).

- **Fix:** fold into one `ExportToolbar` with `density?: 'default' | 'compact'`.
  Severity **P3**, effort **S**.

#### F9. Bulk-action bars: good pattern, one layer too many

Ten per-module `*BulkActionBar.tsx` adapters (1,025 LOC total) mostly delegate to
`ModuleUniversalBulkActionBar` with a manifest-driven `bulkActions` prop — e.g.
`HasanatBulkActionBar.tsx` is a correct 39-line thin adapter reading
`HASANAT_MODULE_MANIFEST.work.bulkActions`. But three underlying bars exist
(`ModuleUniversalBulkActionBar`, `ModuleWorkBulkActionBar`, plus the older
`BulkActionDock`/`BulkSelectionBar` family), and three adapters are fat with custom
logic (`FacultyBulkActionBar` 151 LOC, `StudentsBulkActionBar` 132,
`MessagingWorkBulkActionBar` 107).

- **Fix:** converge on `ModuleUniversalBulkActionBar` as the single bar; let module
  pages pass `manifest.work.bulkActions` + `i18nNamespace` directly and delete the
  39-line pass-through adapters; extract the three fat adapters' custom actions into
  manifest-driven extension slots. Severity **P3**, effort **M**.

### P3 — Token & enforcement gaps

#### F10. Raw palette utilities survive because nothing bans them

`scripts/check-code-norms.mjs:161` bans hex literals outside `@theme`, but no check
covers Tailwind palette utilities. Current violations: `ThemeModeSelector.tsx`
(**17** hits), `obligations/components/wakala/WakalaStep3Distribution.tsx` (2), and 4
test files (faculty/messaging). `index.css` itself is clean.

- **Fix:** convert the two source files to `SEMANTIC_*`/token classes, then add a
  palette-utility rule to `check-code-norms.mjs` (or an eslint rule next to
  `no-physical-directional-classes.cjs`) so the count ratchets at 0. Severity **P2**
  (norm exists in `mms-ui-ux-design.md` §2 but is unenforced — the repo's own rule
  says a norm is either machine-enforced or advisory), effort **S**.

#### F11. Module pages bypass the scaffold's tab contract

`ModuleScaffold` (`apps/frontend/src/components/common/ModuleScaffold.tsx:40`)
already accepts `tabs`/`activeTab`/`onTabChange`/`metricsStrip`, and all 17 module
pages reach it through the `ModulePageShell` alias
(`apps/frontend/src/components/ui/ModulePageShell.tsx`) — good. But 15 feature files
still import `ResponsiveAccordionTabs` directly and hand-assemble tab bars inside page
bodies (e.g. `tenant/features/finance/FinancePage.tsx`), and tab/tier motion wiring
(`ModuleTierMotion`, 43 imports; `SubTabBar`, 24) is re-assembled per page.

- **Fix:** migrate pages to pass tabs via the scaffold props so tier navigation,
  SEO, and suspense chrome have one implementation; keep per-tier content as children.
  Severity **P3**, effort **M**.

#### F12. Hygiene: stale `.tmp` artifacts in `packages/shared/src`

Six `*.tmp` files (`appTranslations*.tmp`, `permissions.ts.tmp`) sit in the shared
source tree. They are gitignored/untracked (not a correctness issue) but pollute local
searches and editor symbol indexes.

- **Fix:** delete locally; optionally have the generating script clean up on success.
  Severity **P3**, effort **trivial**.

---

## What is already strong (do not refactor)

- **Token pipeline:** one `@theme inline` block with HSL-var indirection + OKLCH
  overrides (`index.css:9-120`), inert-token check that catches Tailwind v3-namespace
  tokens (`check-code-norms.mjs:177`), `semanticTone.ts` (36 import sites) and
  `formStyles.ts` class helpers, and logical-CSS enforcement via
  `eslint-rules/no-physical-directional-classes.cjs`.
- **Module manifests as SSOT:** `standardModuleConfigRegistry.ts` imports every
  module's manifest, default settings, and field defs from `@mms/shared` — exactly
  the ADR 0001 model.
- **Collections facade discipline:** `tenant/hooks/collections/*.ts` act as
  cross-module public surfaces (e.g. `students.ts` re-exports from the feature with an
  explicit "import from here" contract), backed by `queryFactories.test.ts`.
- **Legacy containment:** `useLiveCollection` survives in only 3 files
  (`dbCollections.ts`, settings' `SystemModulesSettings.tsx`, `useBackupRestore.ts`),
  matching the `mms-data-sync` migration policy; feature boundaries are guarded by
  `eslint-rules/no-cross-feature-imports.cjs`.
- **Entry/auth composition:** both auth layouts share `@/components/entry`
  primitives — the working template for fixing F5/F6.
- **Host isolation:** tenant/platform branching is confined to 9 files behind
  `useIsTenantHost` (`lib/host/`), with hard-redirect boot gates — no scattered
  `if (isPlatform)` conditionals in feature code.

---

## Roadmap

**Phase P1 — Shared-contract consolidation (SSOT gaps).** F1 → F3 → F2. Delete
duplicate constants, move response envelopes to `@mms/shared`, then converge
invalidation on `createModuleQueryInvalidator` with a `check-code-norms.mjs` ratchet
on raw `invalidateQueries`. Land the F10 palette-class rule in the same pass (norms
script is already the right home). Low risk; mostly mechanical; run
`pnpm typecheck && pnpm lint && pnpm test` per module.

**Phase P2 — Chrome unification (reuse).** F5 then F6. Extract `CommandPaletteShell`,
then the unified `AppSidebar` with per-host nav adapters. Medium risk (visual
regression surface): gate behind Playwright shell specs
(`e2e/tests/responsive-shell.spec.ts` already exists) and axe smoke
(`mms-a11y-smoke`).

**Phase P3 — Component-pair merges.** F7, F8, F9, F11. One pagination, one export
toolbar, one bulk bar fed by manifests, scaffold-owned tabs. Each merge is a small PR;
delete the losing component only after consumer migration.

**Cross-cutting:** per the repo's enforcement rule ("a norm is either
machine-enforced or explicitly advisory"), every phase lands its ratchet:
F2/F10 rules in `check-code-norms.mjs`; F9 thin-adapter ban via import-count ratchet;
F5/F6 protected by the existing no-cross-feature-imports rule once the shared shells
live in `components/common`.

## Notes

- `docs/architecture.md` §4 already defers the physical reorganization of
  `packages/shared/src` into domain subfolders while another session edits it — this
  audit does not revisit that decision; F1–F4 changes are barrel-compatible.
- The working tree had uncommitted changes in 5 files
  (`BulkSelectionActions.tsx`, `DetailDrawerShell.tsx`, `semanticTone.ts`,
  `WorkspaceSummary.tsx`, `PlatformProfileNameForm.tsx`) at audit time; none were
  modified, and F10's count reflects the dirty `semanticTone.ts` as found.
