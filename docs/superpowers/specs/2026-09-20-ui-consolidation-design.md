# MMS Frontend UI Consolidation — Design Spec

Date: 2026-09-20
Status: Approved (pending written-spec review)
Program: Gap-only UI/UX consolidation across `apps/frontend`, delivered as five sequential sub-projects **B → A → C → D → E**.

## 1. Context and audit findings

An audit of `apps/frontend/src` (2026-09-20) established that the original 7-phase overhaul brief describes work that is largely **already done** on the tenant side. The program is re-scoped to the real gaps. Key findings (all paths relative to `apps/frontend/src`):

- **No `routes/tenant/` or `routes/platform/` exist.** Actual layout: `tenant/routes/TenantRoutes.tsx` + `tenant/features/<module>/` (17 modules) and `platform/routes/ApexRoutes.tsx` + `platform/pages|components/`. Host-based split in `components/routing/HostRoutes.tsx`.
- **Tenant is already consolidated.** 17/17 pages on `ModuleScaffold` (via `components/ui/ModulePageShell.tsx`), 14/14 entity detail drawers on `components/ui/DetailDrawerShell.tsx`, all directory cards on `DirectoryCardsGrid`/`DirectoryEntityCard`, zero native `<select>`, all create/edit via `FormModal` + `FormField`/`FormSelect`.
- **A field/column registry SSOT already exists in `@mms/shared`** (`packages/contracts/src/`): `FieldDefinition`, `TabDefinition`, `ColumnRegistryEntry`, `FieldConfig` envelope, per-module seeds (`contactFieldSeed.ts`, `moduleFieldSetupPersons.ts`, …), column layer (`moduleColumnCore.ts`, per-domain registries, `applyModuleColumnOverlay`), and sync modules. Any descriptor work **extends** this system; it does not create a parallel registry.
- **Token reality.** Tailwind v4 CSS-first (`src/index.css`, `@theme inline`, no `tailwind.config`). Semantic utilities are shadcn-HSL: `bg-card`, `text-muted-foreground`, `bg-primary`, `border-border`, `text-success`, … backed by `:root`/`.dark` CSS vars. TS class-string SSOTs: `src/lib/semanticTone.ts` (`SURFACE`, `SEMANTIC_BADGE/TEXT/BG`, …) and `src/components/ui/formStyles.ts` (`FORM_CARD`, `WORK_SURFACE`, …). **The brief's example tokens (`bg-surface`, `text-text-primary`, `bg-brand-primary`) do not exist** and will not be introduced as a rename.
- **Platform tree is a parallel universe.** `PlatformPageShell`/`PlatformSidebar`/`PlatformCommandPalette` (per-page shell opt-in, no route-level layout), parallel `PlatformWorkspaceCards/Table`, `PlatformAdminCards/Table/Badges`, bespoke forms with zero `FormModal`/`FormField`/`DetailDrawerShell` reuse, manual tab state in `PlatformConsole.tsx`.
- **Residual hardcoded styles are narrow.** Two files hold 44/56 raw-palette matches: `tenant/features/dashboard/components/SetupIncompleteCallout.tsx` (21) and `tenant/features/settings/components/ThemeModeSelector.tsx` (23). The rest is print-template CSS (`CertificatePreview.tsx`, `FinanceTemplateEditor.tsx`, `paperBuilderUtils.ts`, invoice print previews) and data-driven colors (hasanat denominations), plus virtualizer spacers.
- **`components/common/DetailSheet.tsx` is a dead facade** (zero imports); `components/ui/` holds the real detail drawer stack.
- **Duplication concentrates in presentation metadata**: ~15 `use*ColumnLayout.ts` hooks, ~10 `*ListVisibleColumns.ts` files, 17 bespoke `*ListFilters.tsx`/`*FiltersMenuButton.tsx` vs 4 shared chip builders, per-module detail-field arrays (`useContactDetailFields.ts` 120 ln, `studentDetailSortedFields.ts` 64 ln, `facultyDetailFields.ts` 63 ln, `contactCardColumnData.ts` 119 ln, `contactMetadataSubFields.tsx` 97 ln).
- **Tooling research (2026-09-20).** Radix Dialog is React 19–compatible but migrating the codebase's hand-rolled overlays (~65 `FormModal` consumers) is high-churn with known stacked-dialog issues and no functional gain → harden in place. axe-core `color-contrast` returns *incomplete* under happy-dom/jsdom → contrast stays in Playwright e2e + the existing `src/__tests__/designTokens.contrast.test.ts`; FE unit tests assert keyboard traversal, focus trapping, and ARIA. Tailwind community standard is primitive → semantic → component `@theme` layering, which the existing vocabulary already follows.

## 2. Decisions (user-approved)

| # | Decision | Rationale |
|---|---|---|
| D1 | **Gap-only program.** No re-work of consolidated tenant code. | Audit shows it's done; avoids churn and regression risk. |
| D2 | **Extend the existing token vocabulary; no rename.** Gap-fill `@theme` only where missing. | Zero visual regression; complies with `mms-ui-ux-design.md` §2 (semantic tokens only). |
| D3 | **Additive-first sequencing B → A → C → D → E**, each sub-project its own spec → plan → green-landing cycle. | Lowest risk; each lands independently. |
| D4 | **Extend `@mms/shared` registry; no parallel `FieldsRegistry`.** | One SSOT; `mms-fields.md` already governs it. |
| D5 | **Keep hand-rolled overlays; harden in place.** No Radix Dialog migration. | Research + existing focus-trap tests; ~65 consumers would churn. |
| D6 | **axe color-contrast stays in e2e**; FE tests cover keyboard/focus/ARIA. | axe cannot evaluate contrast without layout. |

## 3. Sub-project B — Entity Attribute Descriptor layer

### 3.1 Shared types (`packages/contracts/src/`)

New `entityPresentation.ts` (exact exported names are fixed in Sub-project B's implementation plan; types are FE-consumed pure types, Zod-strict if any later cross the API):

```ts
AttributeValueType = "text" | "currency" | "date" | "datetime" | "badge" | "link" | "avatar" | "boolean" | "email" | "phone";

AttributePresentation<K extends string> {
  key: K;                       // must reference an existing FieldDefinition/ColumnRegistryEntry key
  labelKey: AppTranslationKey;  // i18n only — no raw labels (mms-fields.md §3)
  valueType: AttributeValueType;
  format?: { currency?: string; dateStyle?: "short"|"medium"|"long"; badgeTone?: BadgeTone; linkHref?: (row) => string };
}

EntityPresentationRegistry<K extends string> {
  entity: string;               // e.g. "contact", "student", "workspace"
  attributes: Record<K, AttributePresentation<K>>;
  surfaces: {
    table: K[];                 // default column order (subset/ordering over column registry)
    card: K[];                  // DirectoryCardMetadata slots
    filters: FilterChipPreset<K>[];
    detail: { section: string; sectionLabelKey: AppTranslationKey; rows: K[] }[];
  };
}
FilterChipPreset<K> { key: K; operators: ("is"|"is-not"|"contains"|"range")[]; optionsKey?: string }
BadgeTone = "primary"|"success"|"destructive"|"warning"|"info"|"secondary"|"muted";
```

- Keys are typed against each module's existing registry keys via `satisfies`-based mapping types, so drift is a compile error; modules without a typed seed get their key union from the seed types directly.
- **Parity invariant** (respects `mms-fields.md` form/drawer parity ban): the descriptor must cover *every enabled* registry field for the entity. Enforced by a shared unit test comparing descriptor key sets against the module's `FieldConfig`/column seeds — never a hand-picked allowlist, never `switch(field.key)` returning `null`.

### 3.2 FE adapter layer (`apps/frontend/src/`)

- `lib/entityPresentation/useEntityPresentation.ts` — resolves a registry + row into render props (formatted value, badge tone class from `semanticTone.ts`, href). Pure, unit-tested.
- Descriptor-driven rendering paths added to/used by: `DirectoryCardMetadata.tsx` (generic already), `FilterChips.tsx`, `ModuleColumnCustomizer.tsx` (consumes existing column registries), and a new `DetailAttributeSection.tsx` renderer composing `DetailAttributeRow`/`DetailSectionTitle`.
- **Token-class guarantee:** resolved class strings come only from `semanticTone.ts`/`formStyles.ts` SSOTs. Unit tests assert outputs ∈ SSOT allowlists (no raw palette strings).

### 3.3 Migration order and deletions

contacts → students → faculty (reference directory modules) → sessions/finance/enrollments/examinations → accounting/users/messaging/question-bank/hasanat/obligations → attendance (filters only) → platform workspaces/admins (feeds C).

Per-module legacy arrays deleted as each lands: `useContactDetailFields.ts`, `studentDetailSortedFields.ts`, `facultyDetailFields.ts`, `contactCardColumnData.ts`, `contactMetadataSubFields.tsx`, `*ListVisibleColumns.ts`, `build*WorkFilterChips.ts`, bespoke `*ListFilters.tsx` where subsumed.

## 4. Sub-project A — Unified AppShell

- New `components/shell/AppShell.tsx`: owns `SkipToContentLink`, collapsible sidebar, mobile drawer, top bar, command-palette outlet, `AppFooter`.
- `NavigationAdapter` interface: `{ items, brand, paletteItems, userMenu, sessionBehaviors }`; two adapters — `tenantNavAdapter` (from `tenant/components/layout/useSidebarNav.ts`) and `platformNavAdapter`.
- `tenant/components/layout/AppLayout.tsx` becomes the base (richer: branding init, session timeout, sync badge); `PlatformPageShell`/`PlatformSidebar`/`PlatformCommandPalette` deprecated. `ApexRoutes.tsx` moves to a route-level layout element instead of per-page shell calls; auth pages keep `PlatformAuthLayout` as an adapter variant.
- Host-based `HostRoutes.tsx` split unchanged.

## 5. Sub-project C — Platform content migration

- `PlatformConsole.tsx` manual tab switch → `ModuleScaffold` tab slots; sub-content migrated progressively.
- Workspaces/admins onto `DirectoryCardsGrid`/`DirectoryEntityCard`/`DetailDrawerShell`/`StatusBadge`, driven by B descriptors (new `workspace`/`platformAdmin` registries).
- Platform forms (`PlatformAddAdminForm`, `PlatformAdminPermissionsFields`, workspace dialogs) → `FormModal` + `FormField`; bespoke confirm dialogs → `AlertDialog` primitive.
- Delete parallel `Platform*Cards/Table/Badges` after parity. `e2e/tests/platform-console-critical.spec.ts` green throughout.

## 6. Sub-project D — Token & a11y hardening

- Tokenize `SetupIncompleteCallout.tsx` and `ThemeModeSelector.tsx` via `semanticTone.ts`/`formStyles.ts`; `ThemeModeSelector` literal theme previews get token-mapped equivalents (or a documented rule exception if literal previews are semantically required).
- Centralize print-template CSS (`CertificatePreview`, `FinanceTemplateEditor`, `paperBuilderUtils`, invoice print previews) + hasanat denomination colors into a shared `printTemplateStyles` module (hex constants in one place; reduces `check-code-norms` hex-file ratchet count).
- Gap-fill `@theme` tokens only where the above needs a missing semantic token; extend `designTokens.contrast.test.ts` coverage for new tokens.
- a11y hardening of `useOverlayBehavior` (focus return on close, `aria-modal`, inert backdrop) + keyboard/ARIA unit tests for `Modal`, `FormModal`, `DetailDrawerShell`, `CommandPalette`; contrast stays in e2e.

## 7. Sub-project E — Rule synchronization

- `mms-fields.md`: entity presentation descriptor pattern + parity invariant.
- `mms-dry.md`: mandatory descriptor reuse; deletion list of superseded per-module arrays.
- `mms-ui-ux-design.md`: AppShell conventions, token decisions (incl. print-CSS quarantine, ThemeModeSelector exception if adopted).
- `mms-form-architecture.md`: platform form migration onto `FormModal`/`FormField`.
- Run `bash .agent/scripts/sync-all.sh` + `node scripts/verify-rules-integrity.mjs`.

## 8. Cross-cutting constraints

- File-size hard ceiling ~300 ln (`mms-structure-naming.md` §3) for all touched/new files; stable barrels; named exports (default only for lazy `*Page.tsx`).
- Coverage ratchets (`apps/frontend/vitest.config.ts`: lines 41/stmts 40/funcs 32/branches 39) must not decrease; `check:code-norms` ratchets must not worsen.
- Labels strictly via `labelKey`; `check:i18n` parity for all new keys (en/ar/ur/fa).
- No `any` in touched code; no physical directional classes (BiDi logical properties only); `min-h-11 min-w-11` interactive floor.
- Each sub-project lands with `pnpm typecheck`, `pnpm test:frontend`, `pnpm lint`, `check:code-norms`, and `verify-rules-integrity` green before the next starts.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Descriptor key drift vs module registries | Branded key typing + parity unit tests (§3.1). |
| Platform route restructure breaks e2e | `platform-console-critical.spec.ts` + `a11y-shell.spec.ts` run before/after; route structure changed only in A, content only in C. |
| Filter-chip migration loses bespoke behaviors | Migrate one module at a time; colocated tests move with behavior, not deleted until parity proven. |
| Print-surface styling regression | Print CSS moved verbatim into shared module first (no value changes), tokenized only where app-visible. |
| Long-running drift against `main` | Sub-projects are independent green landings; rebase per sub-project, not per phase. |

## 10. Output format per sub-project

Each sub-project's implementation plan delivers: (1) the step-by-step plan, (2) full file modifications with complete contents/diffs, (3) test-runner logs showing green runs, (4) rule-sync verification log (E only, but B/A/C/D note rule-touching changes for E).

---

## Revision 1 (2026-09-20, post-baseline)

### Baseline adoption

A 51-file uncommitted implementation of this program was discovered in the working tree and adopted as the committed baseline (`8e52ae27`), including: the FE entity descriptor registry (types/factory/13 descriptors/tests), unified `AppShell` mounted by both tenant and platform shells with route-level platform layouts, descriptor-aware `FilterChips`/`DirectoryCardMetadata`/`ModuleColumnCustomizer`/`ModuleWorkToolbar`/`DetailSheet`, token fixes in the two worst palette files, and rule edits across all three mirrors. Repairs landed with it: `PlatformPageShell` import restoration in `ApexRoutes`, and `coreDescriptors.tsx` split (400 ln → five per-domain files) to hold the 300-ln ceiling ratchet. Verified green: typecheck, eslint, 637 test files / 2,189 tests, all four `check:code-norms` ratchets.

### Sub-project B redefined (user-approved evolution)

Evidence from the contacts module showed the static descriptor registry is **strictly poorer** than the existing registry-driven renderers (runtime `FieldConfig` with custom fields, `canViewContactField` permissions, tab guards, i18n via `resolveRegistryLabel`, nested-collection presence logic in `contactCardColumnData.ts`). Wiring modules to static descriptors would create two competing sources of field truth — the opposite of SSOT.

B therefore proceeds as: **evolve the descriptor layer into a FieldConfig-backed adapter**.

- B-1: Adapter `createEntityDescriptorFromFieldConfig` mapping shared `FieldDefinition` records → descriptor fields (type mapping, enabled filtering, group→drawerSection, order mapping), with i18n injected via `resolveLabel` (never hardcoded English labels).
- B-2: i18n `labelKey` resolution in descriptor consumers (`DirectoryCardMetadata`, `FilterChips`).
- B-3: Invariant tests — badge classNames ⊆ `SEMANTIC_BADGE` SSOT values; unique keys/orders; adapter parity (covers all enabled registry fields).
- B-4: `DirectoryCardMetadata` merge mode — descriptor-driven tiles compose *with* bespoke module chrome (not replace it).
- B-5: Contacts pilot wiring (Work-tier card metadata), then a review gate before further module rollouts.
- B-6 (follow-up plans): students/faculty/sessions/finance rollouts; missing entities (examinations, messaging, question-bank, accounting, tenant users) via the adapter; deletions of superseded per-module arrays only where the adapter genuinely replaces them. Drawer migration is limited to simple attribute rows; bespoke rich sections (contacts' 20 detail sections) stay.

### Sub-project A remaining scope (reduced)

AppShell exists and both trees mount it. Remaining: navigation parity audit (collapse, mobile drawer, palette, breadcrumbs) and deprecation of any duplicated shell chrome; e2e shell specs must stay green.

### Sub-projects C/D/E (unchanged in intent)

C: platform content migration onto shared primitives. D: print-CSS quarantine + overlay a11y hardening + residual token spots (e.g. sessions palette classes). E: rule sync (B's adapter pattern documented in `mms-fields.md`/`mms-dry.md`).
