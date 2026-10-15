---
name: mms-ui-ux-design
description: Covers the Master Module Scaffold Layout, Tailwind CSS v4 BiDi Design Tokens, and Directional Class Refactoring Guide. Use when designing UI/UX components, enforcing logical CSS properties for BiDi layouts, or adhering to the layout contract. Do NOT use for form field validation and form modals (use mms-form-architecture) or accessibility axe testing (use mms-a11y-smoke).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS UI/UX Design System & BiDi Layout Contract

**Rules (norms SSOT):** `mms-ui-ux-design.md` · `mms-structure-naming.md` · `mms-performance.md`
**Form collection / FormModal chrome:** `mms-form-architecture` (control decision table, `FormCollectionShell`, `FormCardTypeSelect`) — do not invent parallel form card systems in this skill.

## When to use

- Designing UI with BiDi logical CSS and the Master Module Scaffold
- Enforcing design tokens, RTL/LTR layout, or scaffold layout contracts

Use this skill when designing UI/UX components, enforcing logical CSS properties for BiDi layouts, or adhering to the master layout contract.

## Anti-Patterns & Banned Operations

- ❌ **NEVER use physical directional classes**: Banned: `pl-*`, `pr-*`, `ml-*`, `mr-*`, `left-*`, `right-*`, `text-left`, `text-right`, `border-l-*`, `border-r-*`. Use BiDi logical properties exclusively (`ps-*`, `pe-*`, `ms-*`, `me-*`, `start-*`, `end-*`, `text-start`, `text-end`, `border-s-*`, `border-e-*`). Reference `.agent/skills/mms-ui-ux-design/references/bidi-tokens.md`; validate via `node .agent/skills/mms-ui-ux-design/scripts/check-bidi-classes.mjs`.
- ❌ **NEVER use ad-hoc hex colors or raw Tailwind palette**: Banned: `text-red-500`, `bg-blue-600`. Use semantic tokens (`var(--text-destructive)`, `var(--primary)`, `StatusBadge`, `semanticTone`).
- ❌ **NEVER unvirtualize lists > 30 items**: Long table and card lists must use `@tanstack/react-virtual`.
- ❌ **NEVER hardcode English copy**: Render all labels, tooltips, and messages through `t('key')`.

## 1. Master Module Scaffold Layout

The standard module scaffolding requires a strict three-tier page structure with integrated commands:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  Breadcrumb: Academics > Students > Directory                                         │
│  PageHeader: [Icon] Students Management   [Badge: 1,240 Enrolled]   [ + Enroll Student] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Tabs: [ 💼 Work (Directory) ]      [ 📊 Reports & Analytics ]      [ ⚙️ Setup & Fields ] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  FilterToolbar:                                                                        │
│  [ 🔍 Search name, roll no (/) ]  [ Grade: All ▾ ]  [ Status: Active ▾ ]  [ ⊞ Table|Card ]│
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  Dynamic Slot:                                                                         │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Table Header (Sticky)                                                           │  │
│  ├──────────────────────────────────────────────────────────────────────────────────┤  │
│  │ Virtualized Row Items (TanStack Virtual)                                         │  │
│  │ - Row 1: Muhammad Zaid | Roll #104 | Hifz Year 2 | Active Status                 │  │
│  │ - Row 2: Ibrahim Khalil | Roll #105 | Nazira Year 1 | Active Status              │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Dock: [ 3 Students Selected ]  [ Assign Section ]  [ Print Cards ]  [ Deselect (Esc) ] │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Tailwind CSS v4 BiDi Design Tokens

Read `apps/frontend/src/index.css` and `apps/frontend/src/components/ui/formStyles.ts` before adding styles. Existing semantic colors use HSL channel variables and theme mappings; copying an invented OKLCH palette into the same variables breaks consumers such as `hsl(var(--primary))`. Locale font selection belongs to the existing language/theme helpers, not a generic `[dir="rtl"]` font override.

Advisory: reserve dimensions for media and loading states, verify actual font metrics, and use container queries/subgrid when the embedding layout benefits. Neither those primitives nor a fixed Nastaliq line height guarantees zero layout shift.

## 3. Directional Class Refactoring Guide

Enforce logical CSS properties across all shared UI primitives. **The physical→logical class mapping is owned by the rule — see `mms-ui-ux-design.md` §3** (`pl-*`→`ps-*`, `ml-*`→`ms-*`, `left-*`→`start-*`, `text-left`→`text-start`, `border-l-*`→`border-s-*`). Do not re-author the table here; it drifted the last time it was duplicated.

The enforcement is mechanical: `mms-bidi/no-physical-directional-classes` (ESLint, error level) inspects JSX `className` in `.tsx` files. Class tokens held in `.ts` files (e.g. `formStyles.ts`) are outside its reach — check those by eye.

## 4. Modern 2026 UI/UX Reference

For deep-dive implementation details on modern 2026 capabilities (Top-layer `@starting-style`, CSS Anchor positioning, CSS Subgrid, CSS Container Queries, and WCAG 2.2 AA criteria), consult `.agent/skills/mms-ui-ux-design/references/modern-ui-ux-2026.md`.

## 5. UI/UX Pro Max Design Intelligence

Integrate design intelligence from the `ui-ux-pro-max` skill (`.agent/skills/ui-ux-pro-max/SKILL.md`):
- **Design System Generation**: Run `python3 .agent/skills/ui-ux-pro-max/scripts/search.py "<product/feature>" --design-system -p "MMS"` for comprehensive system recommendations (pattern, style, palette, typography, effects, anti-patterns).
- **Targeted Domain Queries**: Query specific guidelines via `python3 .agent/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <style|ux|chart|color|typography>`.
- **Resilient Text & Compact UI**: Headings use `text-wrap: balance`; compact chips and badges wrap or offer operable `+n` disclosures; badge semantics pair with localized `t()` copy; motion transitions (150–300ms) cancel cleanly without corrupting state.
- **MMS HSL Token Mapping**: Map palette colors to existing semantic tokens in `apps/frontend/src/index.css` (`hsl(var(--primary))`, `hsl(var(--card))`, etc.). Raw hex colors remain banned.

## Checklist

```
- [ ] Module follows the 3-tier structure (Work, Reports, Setup)
- [ ] UI/UX Pro Max design system generated or consulted for visual style, palette, and UX guidelines
- [ ] No physical spacing classes are used (e.g., used ps- instead of pl-)
- [ ] No physical positioning classes are used (e.g., used start- instead of left-)
- [ ] Typography follows language-aware overrides (Geist vs Readex Pro vs Noto Nastaliq Urdu)
- [ ] Headings use text-wrap: balance and body/alerts use text-wrap: pretty
- [ ] Chips, badges, and labels reflow without clipping or truncation artifacts
- [ ] Mixed-script user content uses dir="auto" or unicode-bidi: plaintext
- [ ] Card/dialog sub-layouts verified at actual container widths; container queries/subgrid are optional (advisory)
- [ ] Interactive touch targets meet the 44×44px floor (min-h-11 min-w-11)
- [ ] Sticky headers/docks apply scroll-padding to prevent obscuring focused elements (WCAG 2.2 2.4.11)
- [ ] Dragging interactions provide keyboard-accessible single-pointer alternatives (WCAG 2.2 2.5.7)
- [ ] Auth and input fields strictly preserve pasteability (WCAG 2.2 3.3.8)
- [ ] E2E tests include testing the UI on both LTR (English) and RTL (Urdu/Arabic) modes
- [ ] Tables, lists, and card feeds > 30 items use @tanstack/react-virtual virtualization — mms-performance.md
- [ ] Images and charts have explicit width/height dimensions for CLS = 0 — mms-performance.md
```

## Done
Record actual browser/locale/focus checks and observed layout behavior. Do not claim zero layout shift or full accessibility conformance from a static scan.

## Related skills

`mms-shared-ui`, `ui-ux-pro-max`, `mms-frontend`, `mms-form-architecture`, `mms-a11y-smoke`, `mms-settings-i18n`.
