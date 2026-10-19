---
description: Consolidated UI component primitives, design tokens, navigation tabs, notifications, accessibility (RTL / WCAG), and mobile-first responsiveness (§4)
paths:
  - "apps/frontend/src/components/**/*.tsx"
  - "apps/frontend/src/tenant/features/**/*.tsx"
  - "apps/frontend/src/platform/**/*.tsx"
  - "apps/frontend/src/tenant/pages/**/*.tsx"
  - "apps/frontend/src/tenant/components/**/*.tsx"
  - "apps/frontend/src/index.css"
  - "apps/frontend/src/tenant/hooks/useBranding.ts"
  - "apps/frontend/src/lib/notify.ts"
---

# MMS UI, UX & Design System

**Workflow skills:** design intelligence → `ui-ux-pro-max` · modern web guidance → `modern-web-guidance` · shared UI governance → `mms-shared-ui` · primitives/shells → `mms-frontend` · axe/§4 verify → `mms-a11y-smoke` · FormModal norms → `mms-form-architecture`.

## 1. Central Primitives Enforcement
- **Modern Web Standards:** All UI primitives, dialogs, drawers, popovers, and layout elements adhere to `modern-web-guidance` (`pnpx modern-web-guidance@latest search "<query>"`). Implement top layer popovers (`declarative-dialog-popover-control`), backdrop light-dismiss (`light-dismiss-a-dialog`), body scroll locking (`prevent-page-scroll-under-modal-dialog`), entry/exit transitions (`@starting-style`), and motion scaling (`respect-os-text-scale`, `prefers-reduced-motion`).
- **Shared UI SSOT (`@shared/ui`):** All foundational design-system primitives (`Button`, `Badge`, `Input`, `Select`, `Switch`, `Checkbox`, `Textarea`, `Slider`, `Label`, `Card`, `Table`, `Modal`, `DropdownMenu`, `Popover`, `Tooltip`, `Skeleton`, `Avatar`) live in `@shared/ui` (`packages/ui`). Platform Console imports directly from `@shared/ui`. Tenant Console imports either directly or via `@/components/ui/*` facades. Hand-rolled or duplicate UI component implementations across consoles are strictly banned.
- **Banned Raw Controls:** Never emit raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>`, `<dialog>`, or native checkboxes/switches where design system primitives exist.
- **Sanctioned Primitives (`@shared/ui` primitives, `@/components/ui/*` facades, `@/components/app/*` composites, `@/components/common/*` engines):**
  - **Inputs & Controls:** `Button` (min 44×44px), `Input`, `LeadingIconInput`, `FormSelect`, `EditableSelect`, `Textarea`, `Checkbox`, `Switch`.
  - **Overlays & Drawers:** `FormModal` (portal shell), `DetailSheet` / `DetailDrawerShell` (drawer with archive banner and `WarningCallout`), `Popover`, `Tooltip`, `DropdownMenu`.
  - **Layout & Shells:** `AppShell` (universal frame), `ModulePageShell` / `ModuleScaffold` (page shell), `Table` (mandate `@tanstack/react-virtual` when rows > 30).
  - **Directory & Cards:** `EntityCardsGrid`, `EntityCard`, `DirectoryCard` (descriptor work-card composite), `EntityCardFooterActions`, `EntityCardMetadata`, `StatCard`, `ModuleCommandMetricsGrid`, `BulkActionDock`, `ModuleTrashToggle` (`aria-pressed={showDeleted}`).
  - **Form collection chrome:** `FormCollectionShell`, `FormListFieldCard`, `FormAddAnotherButton`, `FormCardTypeSelect`, `FormSelectWithQuickCreate` — norms and control decision table live in `mms-form-architecture.md` (ban inventing parallel form card systems here).
  - **Feedback & States:** `EmptyState`, `ErrorState`, `FieldErrorMessage`, `WarningCallout`, `StatusBadge` (pair with `t()`, never color alone), `notify.{success,error,warning}` from `lib/notify.ts`.

## 2. Design Tokens & Surface Styling
- **Semantic Tokens Only:** Use `index.css` theme mapping (`hsl(var(--primary))`; no standalone `oklch()`). Zero raw hex colors or arbitrary Tailwind brackets (`bg-gray-100`, `rounded-[2rem]`). Print styles quarantined in `lib/printTemplateStyles.ts`.
- **Token-Exemption Register:** Exclusively allowed in `ThemeModeSelector.tsx`, `printTemplateStyles.ts`, `printBrandingTokens.ts`, `documentFavicon.ts`, `qrCodeGenerator.ts`, `extractLogoBrandColors.ts`, `ErdMermaidDiagram.tsx`, `themeScope.ts`, `Brand*.tsx`, and `template-editor/`.
- **Micro-Typography & Sizing:** `text-4xs` (10px floor), `text-3xs` (11px) for pills, `text-2xs` (12px) for compact meta. Semantic z-index: `z-modal` (50), `z-modal-priority` (60), `z-popover` (70), `z-toast` (100). Never write arbitrary font-size or z-index bracket classes (`z-[100]`).
- **Touch Target Floor:** Mandatory `min-h-11 min-w-11` (44×44px) on all interactive triggers, buttons, inputs, and action icons. Never use `min-h-[44px]`.
- **Surfaces & Insets:** Use `WORK_SURFACE` / `WORK_SURFACE_INNER` for panels, `FORM_CARD` for forms (`formStyles.ts`). Use `color-mix(in srgb, var(--primary) 20%, transparent)` for tints. Outer card primitives govern padding (`p-4` / `px-5 py-4`); no child-level inline offsets (`ms-1`). Honor `useReducedMotion()`.

## 3. Accessibility (WCAG 2.2 AA) & RTL Standards
- **Focus & Keyboard:** `focus-visible:ring-2 focus-visible:ring-ring`, focus-return on modal/drawer dismiss, `scroll-margin-top` / `scroll-padding` to prevent sticky headers from obscuring focused controls.
- **Inputs & Forms:** `useId()` for `id`/`htmlFor`, `aria-label` on icon buttons, never block paste on inputs (`onPaste` prevention banned). Provide single-pointer buttons for draggable interactions.
- **BiDi Logical Properties Only:** Physical direction classes are strictly banned. Use logical equivalents: `ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`, `text-start`/`text-end`, `border-s-*`/`border-e-*`, `rounded-s-*`/`rounded-e-*`, and `rtl:rotate-180` for directional icons.
- **Typography:** `text-wrap: balance` on headings, `text-wrap: pretty` on copy. Urdu (`lang="ur"`) requires `line-height: 2.2` and `dir="auto"`.

## 4. Mobile-First Responsiveness & Breakpoints
- **Layout Bounds:** Zero horizontal overflow (`max-w-full`, `100vw` limit). No fixed pixel widths (`w-[1200px]`); use relative units. Wrap wide tables in `overflow-x-auto max-w-full`.
- **Mobile Viewports:** Prefer `dvh`/`svh` + `safe-area-inset-*` over raw `vh` for modals and sheets. Unknown tenant subdomains hard-redirect to `/tenant-not-found?subdomain=…`.
- **Breakpoints:** Mobile (<640px base: 1-col forms, card directories), Tablet (640–1024px `sm:`/`md:`: 2-col forms, directory table mode), Desktop (1024px+ `lg:`/`xl:`: AppLayout sidebar, horizontal tier tabs).
- **Container Queries & Zero CLS:** Use `@container` (`@md:`, `@sm:`) for component-width layouts. Explicit `aspect-ratio` or reserved dimensions on media and charts (CLS = 0).

## 5. Data Tables, Live Regions & Contrast Modes
- **Table Semantics:** Real `<table>` elements with `<th scope="col|row">` and `<caption>`. Styling `<div>` grids into tables is banned. Sort headers set `aria-sort="ascending|descending|none"`.
- **Virtualization:** All directories and tables rendering > 30 items must use virtual scrolling via `@tanstack/react-virtual` (`mms-performance.md`).
- **Live Regions:** Background progress, save confirmations, and filter result counts expose `aria-live="polite"` (`role="status"`); busy containers set `aria-busy="true"`.
- **Contrast & Reading Order:** Support `prefers-contrast` and `forced-colors`. DOM order must match RTL visual reading order; positive `tabindex` is banned.

## 6. Single Source of Truth (SSOT) Entity UI Registry
- **Declarative Descriptor:** Primary entities define descriptors via `createEntityDescriptor<T>()` (`@/components/common/entityRegistry`, types at `@/components/common/entityRegistryTypes`).
- **Automatic Derivations:** Single schema drives `getTableColumns()`, `getCardFields()`, `formatFieldValue()`, and `getDrawerSections()`.
- **Zero Forking:** Directory views, cards, filter chips, and detail sheets must consume descriptors; never duplicate ad-hoc column lists or attribute layouts.

## 7. i18n-Resolved Descriptor Hook Pattern
- **Colocation & Resolution:** Every module provides a localized `use{Entity}EntityDescriptor()` hook invoking `useStaticEntityDescriptor` with an application translation key resolver.
- **Consumer Wiring:** Directory views (`ModuleWorkDirectoryShell`, `ModuleWorkTableHeader`, `DirectoryCardMetadata`, `DetailSheet`) consume resolved hook results, never raw descriptor constants or inline translation maps.

## 8. UI/UX Pro Max Design Intelligence System
- **Mandatory Usage When Coding UI/UX:**
  - Consult UI/UX Pro Max (`python3 .agent/skills/ui-ux-pro-max/scripts/search.py "<keywords>" --design-system -p "MMS"`, skill `ui-ux-pro-max`). Use dials: `--density 7-9` for compact administrative directories, `--motion 2-4` for enterprise transitions.
  - Search targeted domains: `--domain style`, `--domain ux`, `--domain typography`, `--domain chart`, `--domain color`, `--stack react`.
- **Mandatory Checks When Reviewing UI/UX:**
  - Semantic Token Compliance: Every color must map to semantic HSL CSS tokens in `index.css`. Raw hex and arbitrary bracket colors are banned.
  - Strict BiDi Logical CSS: Zero physical direction classes (`ps-*`, `ms-*`, `start-*`, `border-s-*`, `rtl:rotate-180`).
  - Touch Target Floor: Mandatory 44×44px (`min-h-11 min-w-11`) on all interactive controls.
  - Text Resilience: Headings use `text-wrap: balance`; layouts reflow cleanly at 375, 768, 1024, 1440px. Chips/tags wrap or use `+n` disclosure.
  - Visual Polish: Pair badge colors with localized text via `t()`. Micro-interactions 150–300ms ease-out, respecting `prefers-reduced-motion`.
  - Keyboard & Focus: Visible focus rings (`focus-visible:ring-2`), no blocked paste, focus return on dismiss.
  - Modern Web Standards Compliance: Cross-check against `modern-web-guidance` guides for all web UI controls (forms, dialogs, popovers, scrollbars, text balancing, animations). Ensure proper disclosure of applied guides.

## 9. Verification Standards
- **Verification Gates:** Verify interactive controls with axe smoke (`e2e/tests/a11y/a11y-shell.spec.ts`, skill `mms-a11y-smoke`) for zero serious/critical violations. Spot-check 375 / 768 / 1024px viewports and RTL (`dir="rtl"`).
