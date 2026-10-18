---
name: ui-ux-pro-max
description: AI-powered design intelligence for UI/UX with 79 styles, 192 color palettes, 74 font pairings, 119 UX guidelines, and 25 chart types across 22 stacks. Generates design systems, styles, colors, typography, layout, and UX reviews. Use when generating design systems, selecting styles/palettes/typography, or retrieving UX & chart guidelines. Do NOT use for backend Fastify APIs (use mms-backend-api), database migrations (use mms-schema-migrate), or form field schemas (use mms-form-architecture).
license: MIT
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# UI/UX Pro Max — Design Intelligence System

**Rule (norms SSOT):** `mms-ui-ux-design.md` · `mms-form-architecture.md` · `mms-reports.md`

## When to use

- Generating a design system, style, palette, or typography pairing for a new module/page
- Looking up UX guidelines, chart types, or stack-specific patterns via the BM25 search scripts
- Reviewing visual hierarchy before implementing with `mms-ui-ux-design` / FormModal primitives

Design intelligence is backed by BM25 search over 79 UI styles (50 active), 192 industry color palettes, 74 font pairings, 119 UX guidelines, 25 chart types, and 22 technology stacks.

## Core Scripts & Search Engine

The skill is powered by bundled Python 3 scripts in `scripts/`:
- `search.py`: CLI search interface for design systems, domains, and stacks
- `core.py`: BM25 search engine and CSV dataset indexing
- `design_system.py`: Multi-domain reasoning generator and palette synthesizer
- `reasoning_contract.py`: Contract definitions for design system output validation
- `validate_data.py`: Integrity validation across all CSV datasets and reasoning rules

Validate dataset health at any time:
```bash
python3 .agent/skills/ui-ux-pro-max/scripts/validate_data.py
```

## How to Query the Design Engine

### 1. Generate Full Design System (New Module, Page, or Feature)

Run `--design-system` with product and mood keywords:
```bash
python3 .agent/skills/ui-ux-pro-max/scripts/search.py "education student academic management" --design-system -p "MMS"
```

The reasoning engine synthesizes:
- **Landing / Page Pattern**: Recommended structure, CTA placement, and section order
- **Visual Style**: Selected from 79 styles (e.g. Minimalist, Bento Grid, Claymorphism, Clean Corporate)
- **Palette**: Cohesive primary, secondary, accent, card, muted, border, ring, and destructive colors
- **Typography Pairing**: Header and body fonts matching product tone
- **Key Effects & Anti-Patterns**: Transitions, shadows, and industry anti-patterns to avoid

Optional design dials (1–10):
- `--variance <1-10>`: Visual variance (1=minimal/centered, 10=bold/asymmetric)
- `--motion <1-10>`: Animation intensity (1=subtle micro-interactions, 10=complex choreography)
- `--density <1-10>`: Spacing density (1=spacious marketing, 10=dense dashboard)

### 2. Domain-Specific Guidance

Query focused design domains for targeted decisions:
```bash
# UI styles and animation effects
python3 .agent/skills/ui-ux-pro-max/scripts/search.py "bento grid" --domain style

# Typography pairings
python3 .agent/skills/ui-ux-pro-max/scripts/search.py "clean modern" --domain typography

# Chart and data visualization recommendations
python3 .agent/skills/ui-ux-pro-max/scripts/search.py "kpi progress target" --domain chart

# UX guidelines, accessibility rules, and anti-patterns
python3 .agent/skills/ui-ux-pro-max/scripts/search.py "badge chip label wraps" --domain ux
python3 .agent/skills/ui-ux-pro-max/scripts/search.py "focus not obscured" --domain ux
python3 .agent/skills/ui-ux-pro-max/scripts/search.py "error summary validation" --domain ux
```

### 3. Stack Guidelines

Query implementation guidelines tailored for React and Tailwind CSS:
```bash
python3 .agent/skills/ui-ux-pro-max/scripts/search.py "responsive layout" --stack html-tailwind
python3 .agent/skills/ui-ux-pro-max/scripts/search.py "rerender memo list" --stack react
python3 .agent/skills/ui-ux-pro-max/scripts/search.py "table" --stack shadcn
```

## MMS Architectural Integration & Guardrails

When applying UI/UX Pro Max recommendations inside MMS, enforce the following invariants:

1. **Semantic HSL Token Mapping**:
   Map recommended hex colors into existing semantic CSS variables (`hsl(var(--primary))`, `hsl(var(--secondary))`, `hsl(var(--card))`, `hsl(var(--muted))`, `hsl(var(--border))`, `hsl(var(--destructive))`). Raw hex literals and arbitrary Tailwind bracket colors (`bg-[#4F46E5]`, `bg-gray-100`) are strictly banned in application code (`mms-ui-ux-design.md` §2).

2. **Strict BiDi Logical CSS**:
   All spacing, alignment, and positioning must use logical properties:
   - Spacing: `ps-*` / `pe-*` (not `pl`/`pr`), `ms-*` / `me-*` (not `ml`/`mr`)
   - Positioning: `start-*` / `end-*` (not `left`/`right`)
   - Alignment: `text-start` / `text-end` (not `text-left`/`text-right`)
   - Borders: `border-s-*` / `border-e-*`, `rounded-s-*` / `rounded-e-*`
   - Directional icons: `rtl:rotate-180`

3. **Touch Target & Sizing Floor**:
   All interactive triggers, action buttons, icon buttons, and form inputs must maintain the mandatory `min-h-11 min-w-11` (44×44px) touch target floor (`mms-ui-ux-design.md` §2).

4. **Resilient Text & Compact UI**:
   - Headings use `text-wrap: balance` as a progressive enhancement; layout must reflow cleanly without broken labels.
   - Essential text must reflow without clipping across 375px, 768px, 1024px, and 1440px viewports (`mms-ui-ux-design.md` §4).
   - Chip and badge collections wrap or provide an operable `+n` disclosure.
   - Status badges must never rely on color alone; always pair with localized text via `t()`.
   - Micro-interactions follow platform timing (150–300ms ease-out) and honor `prefers-reduced-motion`.

5. **Sanctioned Primitives Only**:
   Render controls through MMS design system primitives (`Button`, `FormModal`, `Table`, `DirectoryEntityCard`, `StatCard`, `StatusBadge`). Never emit raw unstyled HTML inputs or buttons (`mms-ui-ux-design.md` §1).

## Pre-Delivery Verification Checklist

```
- [ ] UI/UX Pro Max design system generated or consulted for visual style and palette
- [ ] Colors mapped to semantic HSL tokens in index.css (no raw hex or arbitrary brackets)
- [ ] BiDi logical classes used exclusively (zero physical pl/pr/ml/mr/left/right)
- [ ] Touch target floor of 44×44px (min-h-11 min-w-11) satisfied on all controls
- [ ] Typography follows language-aware overrides with text-wrap: balance on headings
- [ ] Chips, badges, and metadata reflow without clipping at 375px, 768px, 1024px, 1440px
- [ ] Transitions use appropriate timing (150-300ms) and respect prefers-reduced-motion
- [ ] No emojis used as UI icons (Lucide SVG icons only)
- [ ] Keyboard navigation visible (focus-visible:ring-2) and focus-return verified
```

## Related skills

`mms-ui-ux-design`, `mms-form-architecture`, `mms-frontend`, `mms-reports-export`.
