# UI/UX Review — MMS Frontend

> **STATUS: all 16 findings addressed.** See `docs/ui-ux-review-resolution.md` for
> what changed per finding, the verification run, and the residual items that need a
> rendered-browser (axe) confirmation. The findings below are kept as the original
> record and are written in the present tense as of the review date.

**Scope:** `apps/frontend` (2,533 TS/TSX files, ~241k LOC) plus the design-token layer
(`src/index.css`), the `@mms/shared` translation corpus, and the E2E a11y gate.
**Method:** code reading plus measured checks — contrast computed with the project's own
`getContrastRatio` (`packages/contracts/src/brandingColorContrast.ts`), an independent
regex sweep for banned classes, ESLint run over the whole frontend, and key-parity
computation over the four locale bundles.

Everything below is reproducible from the commands named in each finding. Findings are
ordered by user impact, not by how easy they are to fix.

---

## Executive summary

The frontend is in unusually good shape for its size. BiDi discipline is real and
machine-enforced, i18n is essentially complete (7,224 keys × 4 locales with **zero**
missing keys), the module scaffold is genuinely standardized, tap targets are 44px *by
construction*, breakpoints are fully centralized, and there is a working axe gate in CI
with a documented baseline.

The problems are concentrated in **one layer: the design tokens**. The default light
palette cannot satisfy WCAG AA as a *text* colour, a dark-mode destructive token is
effectively invisible, the focus ring misses the non-text contrast minimum, and the
global print stylesheet deletes printed ID cards. These are single-point fixes at the
token level whose blast radius is the entire app — which is exactly why they have
survived 241k LOC of otherwise careful work.

| Area | Grade | Notes |
|---|---|---|
| BiDi / RTL class discipline | **A** | 0 physical classes across 1,941 files (independently verified) |
| i18n completeness | **A** | 7,224 keys × 4 locales, 0 missing, ~1% legitimately untranslated |
| Component architecture | **A−** | Strong SSOT primitives; one modal escapes the system |
| Responsive / touch | **A−** | 44px targets by construction; no arbitrary breakpoints |
| A11y infrastructure | **B+** | Real axe gate + baseline; coverage is shell-only |
| **Colour & contrast** | **F** | Light-theme text tokens and focus ring fail WCAG AA |
| **Print** | **F** | Printing a student/teacher ID card yields a blank/black page |

---

## P0 — Critical

### 1. The light-theme semantic palette fails WCAG AA as text (and every primary button)

Measured with the project's own `getContrastRatio` against the tokens in
`apps/frontend/src/index.css:246-298`:

| Token pair | Ratio | WCAG AA (4.5:1) |
|---|---|---|
| `--primary-foreground` on `--primary` (`#ffffff` on `#d09611`) | **2.61:1** | **FAIL** |
| `--primary` as text on `--card` | **2.61:1** | **FAIL** |
| `--primary` as text on `--background` | **2.46:1** | **FAIL** |
| `--destructive` as text on `--card` | **3.76:1** | **FAIL** |
| `--success` as text on `--card` | **3.52:1** | **FAIL** |
| `--warning` as text on `--card` | **3.16:1** | **FAIL** |
| `--info` as text on `--card` | 4.73:1 | PASS |
| `--muted-foreground` on `--card` | 4.57:1 | PASS (marginal) |
| `--ring` vs `#ffffff` (focus indicator, WCAG 1.4.11 needs 3:1) | **2.61:1** | **FAIL** |

The **dark** theme fails differently but just as badly — here the damage is concentrated
in `--destructive`, which is tuned dark enough to serve as a fill and therefore vanishes
as text (measured against `--card` `#241d14`, `--background` `#18120c`):

| Token as text | Hex | On `--card` | On `--background` |
|---|---|---|---|
| `--destructive` | `#7f1d1d` | **1.66:1** FAIL | **1.85:1** FAIL |
| `--info` | `#2c74e8` | **3.78:1** FAIL | **4.22:1** FAIL |
| `--success` | `#25b17e` | 6.08:1 PASS | 6.78:1 PASS |
| `--warning` | `#d37c17` | 5.29:1 PASS | 5.89:1 PASS |
| `--primary` | `#f2ad0d` | 8.53:1 PASS | 9.52:1 PASS |
| `--muted-foreground` | `#a89e8a` | 6.28:1 PASS | 7.01:1 PASS |
| `--ring` (as focus indicator) | `#f2ad0d` | 8.68:1 PASS | — |

At **1.66:1** dark-mode `text-destructive` is effectively invisible, and it is used for
validation errors, destructive row actions, overdue amounts and delete confirmations —
the text a user most needs to read. Dark mode otherwise passes comfortably, so the fix
here is confined to `--destructive` and `--info`.

Blast radius (counted across `src/`, excluding tests):

| Class | Usages | Files |
|---|---|---|
| `text-primary` | 623 | 304 |
| `text-destructive` | 251 | 150 |
| `text-success` | 202 | 104 |
| `text-warning` | 118 | 67 |
| `text-info` | 80 | 39 |

The most consequential single line is `components/ui/button.tsx:13`:

```
default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
```

White on `#d09611` is **2.61:1** — so the label of *every default Button in the
application* is below AA, and below even the 3:1 large-text threshold. This is the
highest-traffic text in the product.

**Root cause: one token serving two incompatible roles.** `--destructive` is tuned as a
*fill* (dark enough that `--destructive-foreground` passes on it) and then reused as
*text* on light surfaces. The two roles have opposite luminance requirements. Both
usages exist side by side:

- fill role — `components/ui/FormModalTabs.tsx:79`: `"bg-destructive text-destructive-foreground"`
- text role — `components/ui/FormFooterChip.tsx:9`: `"bg-destructive/10 text-destructive border-destructive/20"`

`--primary` has the same conflict (`text-primary` links/badges vs `bg-primary` buttons).

**The project already owns the fix.** `ensureAccentButtonContrast()`
(`packages/contracts/src/brandingColorContrast.ts:60` — *"Darkens or saturates an accent
until white label text meets WCAG AA (4.5:1)"*) is applied to branding/logo-derived
colours (`logoBrandPaletteDerive.ts:52`, `logoBrandHexUtils.ts:48`,
`brandingColorSuggest.ts:58`) and unit-tested at `brandingTheme.test.ts:139`. It is
simply never applied to the **default** palette, so a workspace with no custom branding
gets a failing theme.

**Suggested fix (design-owner decision, as `docs/a11y-baseline.md` already notes):**
split the tokens by role rather than darkening the brand hue globally — keep `--primary`
for fills/accents and add `--primary-strong` / `--destructive-strong` (etc.) for text
and small badges, then repoint the ~1,274 `text-<semantic>` usages. Run the defaults
through `ensureAccentButtonContrast()` as the acceptance test.

> **Note on the existing baseline.** `A11Y_BASELINE['color-contrast']` in
> `e2e/helpers/a11y.ts` and `docs/a11y-baseline.md` describe this as *"one root cause,
> three observed sites"*. That characterisation understates it: the defect is
> token-level and affects ~1,274 text usages plus every primary button. The ratchet is
> protecting three symptoms of a much wider condition, so the baseline entry should be
> rewritten to name the token, not the three nodes.

### 2. Printing an ID card produces a blank (and then black) page

`apps/frontend/src/index.css:564-582` hides, for **all** printing:

```css
button, input, select, .print-hidden, .print\:hidden,
.border-b.border-border, [role="tablist"], [role="toolbar"],
[role="search"], [role="group"], .shadow-sm, .shadow-xl { display: none !important; }
```

Three compounding defects on the same flow:

1. **`.shadow-sm` hides the card itself.** The printable card carries `shadow-sm`:
   - `tenant/features/students/components/StudentIdCardModal.tsx:79`
   - `tenant/features/faculty/components/FacultyIdCardModal.tsx:81`

   There is no `.id-card-preview` print override anywhere — `src/index.css` is the only
   stylesheet in the app and contains no `id-card` rules. Both modals call
   `window.print()` on the **current** window (`StudentIdCardModal.tsx:37`), so the rule
   applies. The card is `display:none` → blank page.

2. **The modal backdrop prints.** `OVERLAY_BACKDROP` is `bg-sidebar/90 backdrop-blur-sm`
   (`components/ui/formStyles.ts:55`) on a `fixed inset-0` element that no print rule
   hides — and `index.css:586-588` sets `print-color-adjust: exact`, which *forces*
   backgrounds to render. Result: a near-opaque dark rectangle across the printout.
   (`.shadow-sm`/`.shadow-xl` are hidden but the backdrop uses neither.)

3. **Batch cards are clipped.** `.id-card-print-container` has
   `max-h-dialog-scroll overflow-y-auto` (`StudentIdCardModal.tsx:74`) — a bounded
   scroll container, so only the visible rows are printable.

Print is not a fringe feature here: `window.print()` is invoked from 12 call sites
against the app's own document, and `components/ui/TemplateEditor.tsx:93` +
`ExportToolbar.tsx:76` route document export through it. 26 elements already use
`print:hidden` for opt-out — the opposite polarity to what the stylesheet assumes.

**The affected flows, precisely.** The team already implements print correctly in three
places, but only where a popup is involved: `CertificatePreview.tsx:38`,
`PrintInvoiceModal.tsx:140` and `paperBuilderUtils.ts:140` each
`window.open("", "_blank")` and `document.write()` a self-contained document with its
**own** `@media print` rules — so the global stylesheet never touches them, and those
certificates/invoices/question papers print correctly. The broken set is exactly the
12 sites that print the **live app document**: student and teacher ID cards,
`DashboardPage.tsx:76`, `StudentResultCard.tsx:89`, `TemplateEditor.tsx:93`,
`TemplateEditorExportActions.tsx:55`, `ExportToolbar.tsx:76`, and
`DynamicChartVisualizerPreviewHeader.tsx:159`. The fix is either to widen the popup
pattern that already works or to scope the global rules as below.

**Fix:** delete the blanket `.shadow-sm` / `.shadow-xl` / `button` / `[role="group"]`
rules. Hide by explicit opt-in (`.print-hidden`, `print:hidden`) instead of by
incidental utility class, hide the overlay backdrop explicitly in print, and reset
`max-height`/`overflow` on print containers:

```css
@media print {
  [data-overlay-backdrop], .print-hidden { display: none !important; }
  .id-card-print-container { max-height: none !important; overflow: visible !important; }
}
```

---

## P1 — High

### 3. Escape closes every open overlay at once

`hooks/useOverlayBehavior.ts:31-42` registers a **window-level** `keydown` listener that
calls `onClose()` with no notion of which overlay is topmost:

```ts
window.addEventListener("keydown", handleKeyDown);
```

The drawer and the confirm dialog are mounted simultaneously — `ContactDetail.tsx:119`
renders `<DetailDrawerShell>` and `:152` renders `<ConfirmAlertDialog>` as its child
(same pattern in `StudentDetail.tsx`, `TeacherDetail.tsx`, `InvoiceDetail.tsx` and ~20
more `*Detail` modules). Radix's `AlertDialog` independently handles Escape via its own
layer stack. Pressing Escape over the confirm dialog therefore dismisses **the dialog
and the drawer behind it**, dropping the user out of the record they were viewing and
losing context after a confirm/cancel.

`useBodyScrollLock.ts` already solves the analogous nested problem correctly with a
reference counter — the Escape path needs the equivalent (a module-level overlay stack
where only the topmost instance responds), or these drawers should move onto Radix
`Dialog` so the layer stack is handled for you.

### 4. `SessionTimeoutModal` sits outside the overlay system

`components/session/SessionTimeoutModal.tsx:32-36` is the only modal not built on
`Modal`/`useOverlayBehavior`. Credit where due — it already has `role="dialog"`,
`aria-modal="true"`, `aria-label`, `role="status"` on the countdown and `aria-hidden`
icons. But it has:

- **no focus trap and no initial focus** — a keyboard user must Tab through the entire
  page behind the modal to reach "Stay signed in", on a dialog whose whole purpose is to
  be acted on before a deadline;
- **no `useBodyScrollLock`** — the background scrolls under the overlay;
- **`aria-modal="true"` without enforcing inertness** — the attribute tells assistive
  tech the background is unavailable while it remains tabbable and activatable, which is
  worse than omitting it;
- **off-scale `z-[120]`** — above `--z-index-toast: 100` (`index.css:200`);
- **`bg-black/50`** instead of `OVERLAY_BACKDROP` (`bg-sidebar/90`) — the only overlay
  with a neutral-black scrim, so it is visibly inconsistent with every other modal.

**Fix:** render it through `Modal` (trap, scroll lock, backdrop and z-index come free).

### 5. No skip-to-content link in the main tenant app

`platform/components/PlatformPageShell.tsx:42-47` implements a proper skip link using
`t('common.skipToContent')`. The tenant shell has the target but not the link:
`AppLayout.tsx:115-116` gives `<main id="main-content">`, and nothing in
`tenant/components/layout/*` links to it.

The priority is inverted — the tenant app is what every madrasa user opens daily, and it
has a ~20-item sidebar (`SidebarNav.tsx`) that a keyboard user must traverse on every
navigation (WCAG 2.4.1). Copy the four-line anchor from `PlatformPageShell` into
`AppLayout`.

### 6. `dir="auto"` is used once in 1,941 files

User-generated content renders without explicit base direction — e.g. student name in
`tenant/features/students/components/StudentsListDesktopTableCells.tsx:66`, card name in
`components/ui/DirectoryCardHeader.tsx:45`. The only usage in the codebase is
`components/ui/template-editor/TemplateEditorPropertiesPanel.tsx:174`.

In a product that ships four scripts, a Latin-script name inside the RTL UI (or an Urdu
name inside the English UI) renders with the wrong base direction: trailing punctuation
jumps to the wrong side, adjacent numbers reorder, and mixed-script names read
incorrectly. This is the one place where the otherwise-excellent BiDi work leaks, because
logical *classes* are enforced but text *direction* is not.

**Fix:** a small `<BiDiText>` primitive (or a lint convention) that emits `dir="auto"`,
applied to name/label/address/notes text nodes.

---

## P2 — Medium

### 7. Urdu line-height is below the documented Nastaliq requirement

`mms-ui-ux-design` §2 mandates `[dir="rtl"][lang="ur"] { line-height: 2.2 }` for
Nastaliq. `index.css:392-395` sets `line-height: 1.8`. Nastaliq stacks letterforms
vertically and has deep descenders, so 1.8 risks crowding and clipped glyphs — and Urdu
is likely the largest non-Latin audience for a madrasa system. Either raise the value to
the documented 2.2 or amend the skill; today the doc and the CSS disagree and nothing
enforces either.

### 8. `--font-display` resolves to a generic serif for English and Persian

`index.css:249` sets, inside the global `:root` block:

```css
--font-display: 'Amiri', 'Scheherazade New', 'Traditional Arabic', serif;
```

But `lib/localeFonts.ts:4-5` loads **Amiri only for `ar` and `ur`**. For `en` and `fa`
the first three families are unavailable, so `font-display` falls back to bare `serif`.
It is used in 7 places — `AppLayout.tsx:92` (mobile header brand), `SidebarBrand.tsx`,
`AuthLayout.tsx` (login branding), `LoadingState.tsx`, `WorkspaceLogo.tsx`,
`PlatformDashboardBanner.tsx`, `MobileSidebar.tsx` — i.e. brand names and the login
headline render in an unintended serif for English users. Scope the Amiri stack to
`[lang="ar"], [lang="ur"]`. (`Geist` is referenced at `index.css:10-11` and in the skill
doc but never loaded — dead reference.)

### 9. 217 usages of ≤11px text, on top of the contrast failures

| Utility | Size | Usages |
|---|---|---|
| `text-3xs` | 11px | 114 |
| `text-2xs` | 10px | 97 |
| `text-4xs` | 9px | 6 |

10px is already at the edge of comfortable legibility; in Arabic/Urdu/Persian it is
effectively unreadable, and small text is exactly where the WCAG AA threshold applies
(the 3:1 large-text allowance needs ≥18.66px bold). Combined with finding 1, the app's
densest information (metric deltas, timestamps, badges) is both small *and*
low-contrast. Consider raising the floor to 12px for the `2xs`/`3xs` steps and auditing
the 9px cases.

### 10. 29 hardcoded English strings — enumerate and fix the ~15 real ones

The overall i18n discipline is excellent (see "What's already strong"), but these bypass
`t()`:

**Real UI copy — should be translated:**
- `tenant/features/sessions/components/tabs/BudgetTab.tsx` — `:109 aria-label="Budget summary"`, `:132 title="Class Incomes"`, `:146 title="No budgeted income logged yet"`, `:181 title="Class Expenses"`, `:195 title="No budgeted expenses logged yet"`, `:273 title="Confirm Delete"`
- `tenant/pages/setup/InstitutionSetupAddressSection.tsx` — `:44`, `:59`, `:73`, `:88`, `:101` (five address placeholders)
- `tenant/features/sessions/components/tabs/FacultyManagementTab.tsx:291`
- `components/ui/CommandPalette.tsx:91` — `aria-label="Command Palette"`
- `components/ui/ModuleColumnCustomizer.tsx:211` — `aria-label="Clear search"`
- `components/ui/template-editor/TemplateEditorTableSection.tsx:111` — `aria-label="Column width"`
- `components/common/work/WorkTaskToolbar.tsx:140` — `aria-label="Status filters"`

**Legitimately untranslatable (no action):** `alt="Logo"` ×4,
`placeholder="TCH-"`, `placeholder="https://www.yourmadrasa.org"`,
`title="Export Typst Compiler JSON"` / `"Export Zoho Invoice JSON"` (developer tools),
`alt="Receipt Verification QR"`.

Related: `hooks/useTranslation.ts:20-28` silently returns the raw key when
`TranslationContext` is absent, so a missing key renders as `students.idCard.title` with
no diagnostic. Add a dev-only `console.warn` on fallback so key gaps surface in
development rather than in front of users.

### 11. The axe gate covers the shell, not the modules

`e2e/tests/a11y-shell.spec.ts` is the only axe spec — it sweeps `/`, `/contacts` and
`/settings` at 375px and 1440px plus an RTL pass. The reasoning in its header comment
(most breakage comes from shared primitives) is sound, and the gate genuinely runs in
CI. But `tenant/features/**` — 20+ modules with their own tables, wizards and detail
drawers — is not covered, so a violation introduced in a module-specific component is
invisible. Extending `AUDIT_ROUTES` with 2–3 more module surfaces (a Work directory with
a detail drawer open, a form modal, a report) would cover the highest-risk module-level
patterns at modest runtime cost.

---

## P3 — Low

### 12. The z-index scale is partially bypassed

`index.css:190-200` defines a coherent scale, but raw values are used alongside it:
`z-10` ×35 (≡ `z-elevated`), `z-20` ×10 (≡ `z-sticky`), `z-50` ×3 (≡ `z-modal`), plus
`z-30`, `z-40`, and one `z-[120]` (`SessionTimeoutModal.tsx:36`, above
`--z-index-toast: 100`). Values are equivalent so nothing is broken today, but intent is
lost. Also note `--z-index-dropdown: 70` and `--z-index-popover: 70` are identical, so
dropdown-vs-popover stacking resolves by DOM order rather than by design.

### 13. The BiDi ESLint rule does not inspect `cn()`

`eslint-rules/no-physical-directional-classes.cjs` only checks `className` whose value is
a `Literal`, a `JSXExpressionContainer` wrapping a `Literal`, or a `TemplateLiteral`. The
codebase's dominant idiom — `className={cn("flex", isActive && "px-2")}` — is a
`CallExpression` and therefore **never inspected**. I verified independently (a Perl
sweep with proper token boundaries over all 1,941 non-test files) that there are
currently **zero** violations, so this is a latent gap rather than live debt — but the
guard will not catch a regression written in the idiomatic style. Extend the visitor to
walk `CallExpression` arguments for `cn` / `clsx` / `cva`.

### 14. The skill's validation command covers ~21% of the source tree

`check-bidi-classes.mjs:40` defaults to `apps/frontend/src/components` (404 files) while
the tree holds 1,941 non-test TS/TSX files — and `tenant/features/**`, where the modules
live, is entirely outside it. Running the command as the skill documents it prints
"✅ All checked files adhere" and gives false assurance. Default to `apps/frontend/src`
and keep ESLint as the comprehensive gate.

### 15. Hand-rolled status pills

`StatusBadge` + `SEMANTIC_BADGE` are well adopted (109 files import `StatusBadge`, 119
use `semanticTone`). 17 files hand-roll a tinted pill, but on inspection most are
genuinely decorative rather than *status* (branding corner-style selector, welcome
banner, avatar, `FilterChips`) — so this is mostly fine. `AuthStatusBanner.tsx` and
`reports/AcademicReportClassRankings.tsx` are the two worth a look.

### 16. Decorative preview input is tabbable

`components/branding/BrandSemanticPreviewTableTab.tsx:15-21` renders a `readOnly`
`<input>` inside a visual mockup. `readOnly` inputs remain focusable and in the tab
order, so keyboard users land on a control that does nothing. Add `tabIndex={-1}` (and
`aria-hidden`) to preview mocks.

---

## What's already strong (and worth protecting)

These are not consolation prizes — several are better than the industry norm, and two of
them are the reason the findings above are narrow rather than systemic.

- **BiDi class discipline is genuinely enforced, not aspirational.** An independent sweep
  with correct token boundaries found **0** physical directional classes across 1,941
  files (`pl-*`, `pr-*`, `ml-*`, `mr-*`, `text-left/right`, `border-l/r-*`,
  `rounded-l/r-*`, `left/right-*`). ESLint reports 0 violations at error level.
- **i18n is essentially complete.** `en/ar/ur/fa` each carry exactly **7,224** keys with
  **0** missing across the three translated locales. Only 0.8–1.2% of values are
  identical to English, and almost all of those are legitimately non-translatable
  (email/password placeholders, IBAN/SWIFT, export filenames, brand names). That is an
  exceptional result for a 241k-LOC product.
- **Accessible by construction, not by audit.** `button.tsx:8,36-40` puts
  `min-h-11 min-w-11` on the base class so *every* size variant — including `sm` and
  `icon` — is a 44px target. There are 55 raw `<button>` elements and **none** below the
  target. Achieved structurally rather than by review.
- **Layout tokens and breakpoints are centralized.** `lib/breakpoints.ts` mirrors the
  Tailwind scale and there are **0** arbitrary breakpoints (`min-[900px]:`) in the app.
- **The overlay primitives are well built.** `Modal.tsx` uses a portal with
  `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, Escape handling,
  `overscroll-contain` and a 44px close target; `useBodyScrollLock.ts` reference-counts
  nested overlays correctly and compensates for scrollbar width; `useFocusTrap.ts`
  restores focus on unmount and filters `aria-hidden` elements.
- **Loading/empty/error states are proper components, not afterthoughts.**
  `ModuleScaffoldSkeleton` mirrors the real layout to hold CLS at zero and carries
  `role="status" aria-busy="true"`; `EmptyState.tsx` takes a `role` and sets `aria-live`
  accordingly.
- **The a11y gate is real and honest.** `e2e/helpers/a11y.ts` runs axe (WCAG 2.1 A/AA),
  blocks on serious/critical, and — notably — the baseline entries carry written
  rationale and an explicit *"Do not add a baseline entry to unblock a change"* rule,
  with `docs/a11y-baseline.md` documenting a genuine ARIA conflict that was found and
  fixed in `ProgressBar` during the investigation.
- **RTL fonts load on demand rather than up front.** `lib/localeFonts.ts` injects the
  Amiri / Noto Nastaliq Urdu / Vazirmatn / Readex Pro sheets only when `ar`/`ur`/`fa` is
  active, keeping entry pages Inter-only; `providers/DirectionProvider.tsx:42-56` keeps
  `dir`, `lang` and font classes in sync on `documentElement`.

---

## Suggested sequence

Ordered so that each step is independently shippable and the highest-impact work lands
first.

1. **Fix the print stylesheet** (`index.css:564-582`) — smallest change, worst current
   symptom (blank/black ID cards, invoices, certificates). Scope the blanket selectors to
   `.print-hidden` / `print:hidden`, hide the overlay backdrop, and reset
   `max-height`/`overflow` on print containers.
2. **Fix contrast at the token layer** — add text-role tokens
   (`--primary-strong`, `--destructive-strong`, …), repoint the ~1,274 `text-<semantic>`
   usages, and raise `--ring` to ≥3:1 against `--card`. Gate it with the project's own
   `ensureAccentButtonContrast()` as a unit test on the default palette, and rewrite the
   `color-contrast` baseline entry to name the token.
3. **Make Escape overlay-aware** (`useOverlayBehavior.ts:31-42`) — topmost-only close,
   mirroring the reference-count pattern already used in `useBodyScrollLock.ts`.
4. **Move `SessionTimeoutModal` onto `Modal`** — removes four defects at once (focus
   trap, scroll lock, honest `aria-modal`, token-consistent backdrop/z-index).
5. **Add the skip link to `AppLayout`** — four lines, WCAG 2.4.1, benefits every
   keyboard user on every page.
6. **Introduce a `dir="auto"` text primitive** and apply it to user-generated name,
   address and notes fields.
7. **Clean up the P2/P3 tail** — Urdu line-height, scoped `--font-display`, the ~15 real
   hardcoded strings, `cn()` coverage in the BiDi lint rule, and widening the axe route
   list to a few module surfaces.

Steps 1–5 are the ones that change what users experience; 6–7 are hygiene that keeps the
codebase's otherwise strong enforcement honest.
