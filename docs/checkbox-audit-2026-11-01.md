# Checkbox Audit & Fix — 2026-11-01

**Status:** complete. One shared checkbox stack (Radix + `@shared/ui`) is now the single source of
truth; the form-checkbox regression that left checkboxes visually stuck is fixed and guarded by
tests. No API, schema, or route changes.

## 1. Reported symptom and root cause

Clicking a checkbox inside card-style forms (New session → working days / “Every class exam must be
passed”, attendance working days, etc.) fired `onCheckedChange(true)` and re-rendered checked, then
**immediately reverted to unchecked**.

Cause: `FormCheckboxCard` toggled manually from its wrapper `onClick` while also rendering the
checkbox primitive. Radix renders a visually hidden native `<input>` and programmatically clicks it
after activation; that click bubbled to the card wrapper, whose guard only excluded
`button[role="checkbox"]`/`label`, so it ran `onCheckedChange(!checked)` a second time (now `false`).

Table/card selection checkboxes were unaffected only because they do not pass `name`, so Radix did
not render the hidden input.

## 2. What changed

### Primitive (`packages/ui/src/input/Checkbox.tsx`)

- **Activation does not bubble** (`onClick` → `stopPropagation`) so clickable cards, cells, rows and
  queue items can never double-toggle a checkbox.
- **`onCheckedChange` is boolean-only**; Radix’s `"indeterminate"` is normalised at the boundary, so
  consumers no longer repeat `checked === true` / `Boolean(checked)` (12 casts removed).
- **`error` marks `aria-invalid`** and keeps the destructive ring.
- **One CSS-driven indicator pair** (Check + Minus via `data-state`), replacing duplicated
  conditional markup for the indeterminate state.

### Card row (`packages/ui/src/input/FormCheckboxCard.tsx`)

- Guard now treats **any** interactive element (`button, label, input, select, textarea, a`) as
  owning its own activation (defence in depth for Radix’s hidden input).
- Passes `error` through to the primitive (previously only the message/border were error-aware).

### New SSOT row (`packages/ui/src/input/CheckboxField.tsx`)

Labelled checkbox row with a generated id, clickable label, 44 px row floor, `aria-describedby`
description, error message, disabled state and class overrides. Migrated rows:

| Surface | File |
|---|---|
| Login “Remember my email” | `tenant/pages/auth/Login.tsx` |
| Invite user “Send invitation email” | `tenant/features/users/components/InviteUserFormFields.tsx` |
| Onboarding terms | `platform/pages/onboarding/steps/AdminSetup.tsx` |
| Faculty custom boolean field | `tenant/features/faculty/components/FacultyCustomFieldsSection.tsx` |
| Widget threshold toggle | `components/reports/pinnedWidgets/WidgetBuilderThresholdOptions.tsx` |
| Template editor RTL toggle | `components/template-editor/TemplateEditorTypographySection.tsx` |
| Journal mirror amount | `tenant/features/accounting/components/JournalEntryLinesEditor.tsx` |
| Obligation quantity-based | `tenant/features/obligations/components/ObligationTypeFormModal.tsx` |
| Hasanat denomination active | `tenant/features/hasanat/components/DenominationModal.tsx` |
| Saved-report user picker | `tenant/features/reports/components/ContactsSavedReportsEditor.tsx` |

### Consistency & SSOT

- **Exam class chips** used `role="checkbox"` on buttons; they are toggle buttons, so they now use
  `aria-pressed` (no faux checkbox controls remain).
- **Selected-row tint** is now one helper (`workTableRowBg` / `workTableStickyCellBg`). Selected rows
  keep the card surface (the checkbox, tinted sticky cell and selection dock carry the state) because
  any full-row tint pushed translucent status/gender badges below AA; idle hover keeps the neutral
  `bg-muted/40` cue. Rows previously used branding-dependent `bg-accent/15` while their sticky cell
  used `bg-primary/5`.
- **Status badge hover** inherited the default Badge variant's `hover:bg-primary/80`; a green status
  went gold on hover (1.68:1). `StatusBadge` now uses the outline variant with its own semantic
  background/text/border classes, so hover no longer changes the fill.
- **Design-system gallery** demonstrates the controlled `CheckboxField` (with description and disabled
  example) instead of an unlabelled uncontrolled checkbox.
- **Ratchet:** `apps/frontend/src/__tests__/checkboxSsot.test.ts` fails if a raw
  `<input type="checkbox">` or a hand-rolled `role="checkbox"` returns, or if the primitive stops
  being the only implementation.

## 3. Audit coverage

- **36** `Checkbox` call sites audited; all use the primitive (`<input type="checkbox">`: 0).
- Runtime crawl: 20 tenant routes, 6 creation modals, attendance working days, login, users invite,
  table row/select-all/cell-target, card selection, indeterminate select-all, label clicks and
  keyboard Space — **0 stuck checkboxes**, no drawer opened by checkbox activation.
- Platform console: 24 workspace-selection checkboxes, 23 user-row checkboxes and the
design-system `CheckboxField` demo toggle correctly.
- Axe (WCAG 2.1/2.2 A/AA) on login, New session modal and Invite modal: **0 serious/critical**.
- Contacts with **all rows selected** and with a row hovered: **0 serious/critical** after the badge
  hover + selection-tint fixes.
- RTL/mobile: 375 px card selection and Arabic weekday checkboxes toggle correctly.

## 4. Tests added/updated

- `packages/ui/src/input/Checkbox.test.tsx` — no-bubble, boolean callback, `aria-invalid`, CSS-only
  indeterminate.
- `packages/ui/src/input/FormCheckboxCard.test.tsx` — **regression for the hidden-input double toggle**,
  card-background path, error wiring.
- `packages/ui/src/input/CheckboxField.test.tsx` — label/description association, label click, error.
- `apps/frontend/src/components/common/WorkingDaysPicker.test.tsx` — clicking a day emits exactly one
  change.
- `apps/frontend/src/__tests__/checkboxSsot.test.ts` — source ratchet.

## 5. Verification

| Gate | Result |
|---|---|
| Targeted Vitest (checkbox stack + migrated surfaces) | ✅ 129 tests |
| `pnpm typecheck` / `pnpm lint` | ✅ |
| `pnpm ci:local:full` | ✅ `TURBO_CONCURRENCY=1` (CI runner contention produced Vitest worker-start timeouts on parallel runs; every test passed) — frontend **1,044 files / 3,758 passed**, shared **234 / 1,756**, backend **335 / 2,310**, i18n, build, bundle. |
| Rendered crawl | ✅ 20 routes + 6 modals, 0 stuck |
| Axe on login / session modal / invite modal | ✅ 0 serious/critical |

## 6. Design note

Row selection is intentionally indicated by the checkbox, the tinted sticky cell (checkbox/name) and
the selection dock — not by tinting the whole row — so the content’s semantic badge contrast is not
changed by selection. That is a deliberate trade-off, not a missing highlight.

## 7. Follow-up

- `FormModal.saveOnTabChange` and other unrelated form behaviours are outside this audit.
- The `Checkbox` primitive’s 44 px `::after` target is shared with the resize handle/row menus; keep
  using `CheckboxField`/`FormCheckboxCard` rather than re-implementing wrappers.
