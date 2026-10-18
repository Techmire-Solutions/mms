---
name: mms-a11y-smoke
description: Runs accessibility verification for MMS UI work — axe scans, focus-return checks, and touch-target floors on AppLayout, FormModal, Table, and interactive primitives. Use when a11y conformance must be PROVEN for a change (run the axe spec, triage serious/critical violations). Do NOT use for designing tokens or layout (use mms-ui-ux-design), building create/edit forms (use mms-form-architecture), or general component authoring (use mms-frontend).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
compatibility: Requires Playwright browsers for the full axe mode; static mode is dependency-free.
allowed-tools: Read Grep Glob Bash(bash .agent/skills/mms-a11y-smoke/scripts/smoke-a11y.sh) Bash(pnpm test:e2e)
---

# MMS A11y Smoke Workflow

**Rules (norms SSOT):** `mms-testing-observability.mdc` · `mms-ui-ux-design.mdc` §3/§4 · `mms-form-architecture.mdc` (focus-return) · `mms-completion-review.mdc`.

## When to use

- Proving a11y for a UI change (run axe / smoke-a11y, triage serious/critical)
- Verifying keyboard, focus-return, or shell a11y after layout/form work

Do **not** use to invent design tokens → `mms-ui-ux-design.mdc` rule. Do **not** use to build forms → `mms-form-architecture`. Full PR review → `mms-code-review`.

## Anti-Patterns & Banned Operations

- ❌ **NEVER omit accessible names**: Icon-only buttons must have `aria-label` or visually hidden label text.
- ❌ **NEVER show spinner-only pending states**: Long-running lists must use `aria-busy="true"` and polite live regions (`aria-live="polite"`).
- ❌ **NEVER break keyboard focus trapping**: Modal dialogs and detail drawers must trap focus and return focus to the trigger on close.
- ❌ **NEVER use sub-44px touch targets**: Interactive controls must be at least 44x44px (`min-h-11 min-w-11`) on mobile viewports (MMS design policy; WCAG 2.2 AA 2.5.8 specifies 24×24 CSS pixels with exceptions).
- ❌ **NEVER block copy-paste on inputs**: Banning paste on password, OTP, or 2FA fields is forbidden (WCAG 2.2 3.3.8).
- ❌ **NEVER obscure focused controls with sticky bars**: Scrollable containers with floating/sticky headers or action docks must declare `scroll-padding` (WCAG 2.2 2.4.11).
- ❌ **NEVER provide drag-only operations**: Column customizers and layout reorderers must provide single-pointer keyboard alternatives (WCAG 2.2 2.5.7).

## Workflow

1. Confirm the change hits app shell or shared interactive primitives (AppLayout, FormModal, Table, buttons/inputs).
2. Keyboard path + accessible name/label spot-check on new controls.
3. FormModal/drawer: focus trap + **focus-return** to the opener on close.
4. Run `@axe-core/playwright` (or equivalent) on shell + one Work directory at **375** and **1440**; fail on serious/critical.
5. Work list pending: `aria-busy` / polite live region (not spinner-only) — `mms-ui-ux-design.mdc` §3.
6. Touch targets ≥ 44px (`min-h-11` / `min-w-11`); no page horizontal overflow.
7. Verify non-obscured focus indicators under sticky/floating elements (`scroll-padding`).
8. Honor `prefers-reduced-motion`; semantic landmarks (`main`/`nav`/`section`) preserved.
9. When FormModal chrome touched: spot-check `dvh`/`svh` + safe-area — `mms-form-architecture.mdc`.
10. Responsive shell specs named in `mms-ui-ux-design.mdc` §4 when layout chrome changed.
11. If out of scope, state skip reason in completion review.

## Checklist

```
- [ ] axe serious/critical clean; report a failing scan explicitly even when an issue is filed
- [ ] Focus-return on FormModal/drawer
- [ ] Labels / aria-label on icon-only controls
- [ ] Work list pending: aria-busy / polite live region
- [ ] Non-obscured focus indicators via scroll-padding (WCAG 2.2 2.4.11)
- [ ] Touch targets meet 44×44px floor (min-h-11 min-w-11)
- [ ] Password/OTP paste strictly enabled (WCAG 2.2 3.3.8)
- [ ] Keyboard alternative for any drag interaction (WCAG 2.2 2.5.7)
- [ ] FormModal chrome: dvh/svh / safe-area when touched
- [ ] 375 / 768 / 1440 spot-check when shell touched
```

## Script

`.agent/skills/mms-a11y-smoke/scripts/smoke-a11y.sh` — two modes:

```bash
bash .agent/skills/mms-a11y-smoke/scripts/smoke-a11y.sh          # static heuristics (advisory, exits 0; MMS_A11Y_STRICT=1 to fail)
bash .agent/skills/mms-a11y-smoke/scripts/smoke-a11y.sh full     # real axe gate: Playwright tests/a11y-shell.spec.ts (exits non-zero on violations)
```

Run `full` for any change to `AppLayout`, `FormModal`, `Table`, or shared primitives; static mode is a quick nudge, not evidence.

## Done

Completion-review a11y row satisfied — `mms-completion-review.mdc`.

Advisory: automated axe results are partial evidence. Verify 320 CSS-pixel reflow/zoom, keyboard-only use, dialog nesting, focus return when the opener disappears, reduced motion, forced colors and announcements in a real browser. Focus Appearance is WCAG 2.4.13 (AAA), not 2.4.11 (AA Focus Not Obscured). See the [verified UI reference](../mms-ui-ux-design/references/modern-ui-ux-2026.md).

## Related skills

`mms-testing-e2e`, `mms-ui-ux-design`, `mms-form-architecture`, `mms-code-review`.
