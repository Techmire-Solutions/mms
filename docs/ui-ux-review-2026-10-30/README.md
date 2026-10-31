# UI/UX Review — MMS (2026-10-30)

**Status:** review complete; no product code, API, schema, or configuration changes were made.
This is the rendered-browser counterpart to the earlier code-only reviews in
[`../ui-ux-review.md`](../ui-ux-review.md) and [`../ui-ux-review-resolution.md`](../ui-ux-review-resolution.md).

| | |
|---|---|
| Snapshot | Started at `73a0add2f` + 124 uncommitted files (04:44 PKT); those became commit `54d2eaef0` mid-review (05:25). All P0/P1 re-checked at `54d2eaef0`; renders span both sides of that commit. |
| Environment | local Vite (`:5173`) + Fastify (`:3000`) + seeded Postgres, Chromium (Playwright 1.64) |
| Fixture | synthetic `uiuxreview3317542741` workspace; 20 contacts / 20 students / 20 sessions / 20 faculty / 20 invoices |
| Corpus | **115 unique captures** (123 files), 8 contexts: 1440 / 1024 / 375, light / dark, en / ar / ur / fa |
| Existing shell axe gate | **9/9 passed** (3.2 min) — but it skipped every drawer audit on its empty tenant |
| Existing platform axe gate | **FAILED** at 375 px: 8 `color-contrast` nodes, `4.07:1` |

---

> **Post-review status (2026-10-30):** the findings below were implemented and verified in the working tree; see [RESOLUTION.md](./RESOLUTION.md) for the finding-by-finding evidence and the corrections (44px action hit areas, the missing `top-header` sticky utility, 44px checkbox target, and the non-reproduced sync banner).

## 1. Executive summary

The product is structurally strong: the three-tier module scaffold is consistent, RTL mirroring
works, dark mode is coherent, the shared drawer/onboarding/empty-state primitives are well built,
primary controls hold the 44 px target, and no captured surface produced horizontal page overflow.

The rendered experience is less even than the architecture suggests. Three problems dominate:

1. **Localization can corrupt core data.** Arabic and Persian dates render as `NaN/NaN/NaN`
   because the formatter converts locale digits with `Number()`. This affects the dashboard's
   overdue list and the finance invoice table, including due dates.
2. **A core directory table is visually broken.** The contacts `Name` column is explicitly sized
   to `0px`, so the header text spills into `Gender` and every name collides with its badges.
3. **The platform console is not release-clean.** Its existing axe gate is red, its mobile header
   is visibly broken, and the mobile search button has no accessible name (critical `button-name`).

Around those, the dashboard is overloaded (4,338 px tall at 1440, 7,636 px at 375), mobile module
pages open already scrolled past their own header, language choice does not survive a new
browser/device, and the global search promises student/session search it does not provide.

### Scorecard

| Dimension | Grade | Rationale |
|---|---|---|
| Visual hierarchy & composition | **C** | Strong primitives; dashboard and platform header overpacked |
| Consistency & design-system use | **B−** | Shared scaffolds hold; table/portal/contrast exceptions |
| Typography | **C+** | 159 × `text-3xs` (11 px); English display font resolves to Amiri serif |
| Colour & theming | **B−** | Dark mode and palette coherent; new 4.07 / 4.46 contrast regressions |
| Interaction & feedback | **B−** | Good overlays/toasts; pre-emptive form error, misleading search |
| Navigation & IA | **C+** | Students hidden under collapsed Academics; platform mobile header |
| Forms & data entry | **B−** | Shared FormModal is solid; validation timing and long settings flow |
| Data display | **C** | Contacts name column collapse; truncated mobile KPIs; empty charts |
| Accessibility | **C−** | Red platform gate; 35/115 contexts have serious/critical axe findings |
| Responsive | **C+** | No horizontal overflow, but broken header/auto-scroll/truncation |
| i18n & BiDi | **D** | `NaN` dates, mixed numeral systems, `3/1` pagination, raw dynamic key |
| Perceived performance | **B−** | LCP 0.6–1.8 s warm, CLS 0.01–0.06 typical; late language pack/sidebar shift |
| Copy & terminology | **B−** | Mostly clear; search placeholder and admissions page copy mislead |
| Trust & error recovery | **B** | Offline toast, empty/error states, focused destructive confirms |

**Overall: structurally A−, rendered UX B−, localization D.** The gap is concentrated in the
localization layer, the Work-directory table, and the platform shell — not the architecture.

---

## 2. Method and coverage

### What was captured

- **All 20 tenant module Work surfaces** at 1440 and 375 (light, en), plus the shell/dashboard in
  light/dark at 1440/375, Arabic at 1440, Urdu at 375, and Persian at 1024.
- **All 9 platform console pages** at 1440 light/dark and 375 light; platform onboarding wizard.
- **Entry surfaces:** apex entry, platform login, tenant login, tenant-not-found, authenticated
  404, admissions empty state.
- **States/overlays:** contact detail drawer (1440/375), student registration modal, columns
  customiser, command palette, notifications popover, offline indicator, mobile sidebar, empty
  trash, Reports/Setup tiers.
- **Measurements on every capture:** horizontal overflow, text truncation, computed font-size
  histogram, sub-24 px targets, LCP/CLS via `PerformanceObserver`, `lang`/`dir`/`dark` state, and
  an advisory axe (WCAG 2.1/2.2 A/AA) pass.

Reproduction: `e2e/scripts/capture-ui-ux-review.mjs` (`--provision`, `--session`, `--capture-core`,
`--capture-locales`, `--capture-breadth`, `--capture-states`). Full corpus and contact sheets live in
`.logs/ui-ux-review-2026-10-30/` (gitignored). The harness is local-only and refuses production.

### Coverage matrix

| Surface group | Contexts | Result |
|---|---|---|
| Entry/auth | 1440 & 375, light/dark, en | Captured; login 16 px checkbox is the only small-target finding |
| Tenant dashboard | 1440/375, light/dark, en/ar/ur/fa | Captured; P0 date bug + P1 density |
| 20 module Work tiers | 1440/375 light en; ar/ur/fa core | Captured; table/target issues |
| Reports/Setup tiers | 1440 light en (3 samples) | Captured; empty/quiet states |
| 9 platform pages | 1440 light/dark, 375 light | Captured; gate red + mobile header broken |
| Overlays/forms | 1440 (+375 drawer/sidebar) | Captured; modal validation timing |
| Print | not re-run visually | Existing print guard remains; no new evidence |

### Re-check at HEAD `54d2eaef0`

The mid-review commit did not change these results: Arabic finance still renders **20** `NaN/NaN/NaN`
cells; the contacts `Name` column still computes to **33 px** with the same inline zero width;
`/contacts` at 375 still opens at **`scrollY = 533`**; a fresh browser still loads **`en`** while the
workspace/object store say `ar`; and platform 375 axe still reports **critical `button-name`** plus
`aria-hidden-focus` on the chart container.

### Limits

Chromium only; synthetic fixtures; no real users or screen-reader testing; dev server rather than a
production bundle (devtools were hidden — never report the TanStack devtools button). Aesthetic
judgements are reviewer opinion, labelled as such. The working tree was committed mid-review as
`54d2eaef0`; the key findings were re-checked against that HEAD, but a later change could date them.

---

## 3. Findings

Severity: **P0** task/data correctness broken; **P1** major friction or CI-blocking accessibility;
**P2** noticeable inefficiency/regression; **P3** polish. Every P0/P1 was reproduced in a rendered
session; code references are given where the cause is confirmed.

### P0 — Arabic and Persian dates render as `NaN/NaN/NaN`

**Evidence:** [finance-arabic-dates-1440.png](./screenshots/finance-arabic-dates-1440.png) ·
[arabic-overdue-pagination.png](./screenshots/arabic-overdue-pagination.png)

Measured in the DOM: **5** `NaN/NaN/NaN` cells on the Arabic dashboard's overdue list and **20** on
the Arabic finance table; Persian reproduces **20** on finance. Urdu does not (its formatter keeps
Latin digits).

**Cause:** `packages/shared/src/settings/settingsDateFormattersCore.ts:35-47` builds parts with
`Intl.DateTimeFormat` and then does `Number(parts.find(part => part.type === "day")?.value)`. For
Arabic/Persian, `Intl` returns Arabic-Indic/Persian digits (`"٣١"`, `"۳۱"`), and `Number("٣١")` is
`NaN`. English/Urdu use Latin digits, which is why they work.

**Impact:** invoice due dates, overdue dates, printed/finance documents and any `formatDate`
consumer become unusable in two of the four shipped locales. This is a correctness bug, not a
translation gap. It also means the “4 locales complete” claim is true at the key level but false
at the rendered-output level.

**Fix direction:** normalize the part digits to ASCII before `Number`, or request a Latin numbering
system (`new Intl.NumberFormat("en", { useGrouping: false })` on the part / `formatToParts` fallback),
and add a unit test that asserts `formatDate("2026-03-31")` contains no `NaN` for `ar`, `fa`, `ur`,
`en` under each date format. The existing date-format audits only sample English.

---

### P1 — The contacts `Name` column collapses to 33 px

**Evidence:** [contacts-name-collapse-1440.png](./screenshots/contacts-name-collapse-1440.png)

At both 1440 and 1920 the `Name` `<th>` computes to **33 px** with inline
`width:0px; min-width:0px; max-width:0px`. The header text spills into the next column
(`NameGender`), and row names collide with the gender/Syed badges (“Amina Bukhari” overlaps the
“Female” pill). This is the gold-standard directory.

**Cause chain:** `packages/shared/src/contacts/contactColumnRegistryPrimary.ts:11` declares
`width: 0` (presumably “auto”); `WorkBatchTable.tsx:117` renders `table-fixed w-full`; and
`ResizableTableHead.tsx:132-137` applies any numeric width literally. A zero is therefore a
zero-width column.

**Fix direction:** treat `width <= 0` as “auto” in `ResizableTableHead` (omit the inline width) or
give `Name` an explicit sensible minimum; add a layout regression test that asserts the name header
and cell are at least N px at 1440/1920. The same zero-width contract should be documented in
`dataTableTypes.ts`.

---

### P1 — The platform console's existing axe gate is red

**Evidence:** [platform-workspace-chip-375.png](./screenshots/platform-workspace-chip-375.png)

```
npx playwright test tests/a11y/a11y-platform-workspaces.spec.ts --reporter=list
→ 1 failed: platform workspaces @ 375px (ltr)
   8 × color-contrast
   #92752f on #f8f7f5 = 4.07:1
   <span class="font-bold text-primary">faculty-8de327ff</span>
```

The failing element is the workspace subdomain chip in
`platform/components/workspace/WorkspaceIdentityCell.tsx:53-55`
(`text-primary` inside `bg-muted/60`). It is below AA at 14 px, and the existing test only audits
`#main-content`, so header/sidebar regressions are invisible to it.

Our broader scan of the same pages additionally found:

- **critical `button-name` on the mobile search trigger, on every platform page** —
  `PlatformHeaderUserNav.tsx:49-77` renders an icon-only button with `aria-keyshortcuts` but no
  `aria-label`; its text is `hidden md:inline`. This is a WCAG 4.1.2 failure.
- **`aria-hidden-focus` on Recharts sparklines/charts** — a focusable
  `<svg role="application" tabindex="0">` sits inside `aria-hidden="true"` (`.w-16`, report chart
  wrappers). Keyboard users tab into a chart assistive tech cannot announce.
- **`label-content-name-mismatch`** on 3 search/trigger nodes per platform page (visible
  “Ctrl / ⌘ K” not contained in the accessible name).

**Fix direction:** fix the subdomain chip contrast (own tint or `text-foreground`), add
`aria-label={t("platform.searchConsolePlaceholder")}` to the compact trigger, mark decorative chart
containers `aria-hidden` **without** focusable descendants (or `focusable={false}`/`tabIndex={-1}`
on the SVG), and audit the platform shell (`PlatformPageShell`, header, sidebar) rather than only
`#main-content`. Keep the gate red until fixed; do not baseline it.

---

### P1 — Platform mobile header is visibly broken

**Evidence:** [platform-mobile-header-375.png](./screenshots/platform-mobile-header-375.png)

At 375 px the “MADRASA MS / PLATFORM CONSOLE” lockup wraps into four lines inside a 64 px header,
the search icon overlaps the word “PLATFORM”, and the controls compete for the same row. The
same header carries the unnamed search button above. The page title and primary action below are
fine, which makes the header the only broken region on an otherwise well-composed screen.

**Fix direction:** collapse the wordmark to a compact mark/“MMS” under `md`, give the header a
single primary row, and keep the search trigger icon-only only with an accessible name and tooltip.

---

### P1 — Language choice does not survive a new browser/device

**Evidence (measured):** the review tenant's `workspaces.language` and
`t:<subdomain>:global_settings` are both `ar`, yet a fresh browser context loads `/` with
`html[lang=en]`, `dir=ltr`, and writes an **English** `mms_t:<subdomain>:global_settings` back to
localStorage. A user who chose Arabic on one device sees English on the next.

**Cause:** `TranslationContext.tsx:51` resolves language from
`useGlobalSettings().language`, which reads the device-local object store. `workspace.language`
is written by onboarding/settings but never consumed by the frontend; no server→local hydration
path exists for `global_settings` on boot.

**Impact:** the multilingual promise is device-local only; shared/kiosk devices and new phones
revert to English. It also means settings and language are not part of the account experience.

**Fix direction:** hydrate `global_settings` (or at least `language`) from the workspace on boot,
or read `workspace.language` as the fallback when no device override exists; add a fresh-context
test that sets language server-side and asserts the next context renders it.

---

### P1 — The dashboard is overpacked, duplicative, and truncates money on mobile

**Evidence:** [dashboard-overview-1440.jpg](./screenshots/dashboard-overview-1440.jpg) ·
[dashboard-mobile-top-375.png](./screenshots/dashboard-mobile-top-375.png) ·
[dashboard-mobile-375.jpg](./screenshots/dashboard-mobile-375.jpg)

At 1440 the dashboard is **4,338 px** tall; at 375 it is **7,636 px**. It stacks 8 KPI cards,
pinned analytics, attendance summary, enrollment/attendance/revenue charts, fee summary,
`Outstanding Invoices` and `Overdue Obligations` — the latter two show the **same five students**
in near-identical tables — plus active sessions, quick actions, and notifications. The first
screen is dominated by the welcome card, two floating controls (“Print Summary”, “Customize”),
and eight metric cards; the actual “what needs action now?” content is far below.

On mobile, KPI values truncate: “PKR 23,...”, “Outstanding P...”, “Attendance To...”, “Hasanat
Aw...”. Financial values are not readable at the point of decision, and the two-column cards leave
large empty areas under the descriptions.

**Fix direction:** make the dashboard a priority stack (urgent actions → 3–5 KPIs → one consolidated
receivables panel); make secondary widgets opt-in rather than default; merge the invoice/obligation
lists or clearly separate their domains; move Print/Customize into the page header; on mobile,
allow values to wrap/reflow instead of truncating, and consider one card per row for money KPIs.
This is a composition change, not a token fix.

---

### P1 — Mobile module pages open already scrolled past their header

**Evidence (measured):** direct navigation at 375 px lands at `scrollY = 553` (`/contacts`), `554`
(`/students`), `605` (`/finance`). The page title, subtitle, and KPI strip are already off-screen;
the 375 px contacts capture in the local corpus (`.logs/ui-ux-review-2026-10-30/screens/`) starts
mid-page. `ResponsiveAccordionTabs.tsx` calls `useScrollSurfaceOnChange`, whose
“skip initial” guard does not survive the empty→active tab transition on mount.

**Impact:** every mobile visit starts without context; users must scroll up to learn where they are.
It also weakens the SPA’s orientation and skip-link/focus story.

**Fix direction:** only scroll on a user-initiated tab change, never on mount/route entry; add a
regression test asserting `window.scrollY === 0` after first paint at 375 for each module.

---

### P2 — English display type resolves to Amiri (serif)

**Evidence:** [platform-serif-heading-1440.png](./screenshots/platform-serif-heading-1440.png)

The platform “Welcome back…” heading computes to `font-family: Amiri, serif` in English, as does
the tenant sidebar brand. The CSS fix scoped Amiri to `[lang=ar]`/`[lang=ur]`, but the runtime
`applyDocumentLanguage` overwrites `--font-display` from
`packages/shared/src/core/languageUtils.ts:99-102`, whose **default (English) branch is
`'Amiri', serif`**. This is the residual of prior finding #8: the stylesheet is fixed, the runtime
is not.

**Fix direction:** make the default display stack a sans stack (e.g. Plus Jakarta Sans / Inter),
keep Amiri only for `ar`, and assert the computed value—not just the CSS declaration—in the
locale typography test.

---

### P2 — Row action targets are 28 px, row checkboxes 16 px

Measured on contacts/students/finance: **8** sub-44 px targets per populated row (call, WhatsApp,
SMS, copy ×2, email, select). The action buttons are 28×28; checkboxes are 16×16. They pass
WCAG 2.5.8’s 24 px floor but violate the project’s own 44 px MMS floor, especially on tablets.
The primary page buttons remain 44 px, so this is a row-action exception rather than a global
regression. Fix: use the shared `min-h-11 min-w-11` icon-button variant or enlarge the hit area.

### P2 — Two new contrast regressions from opacity/tints

- Dashboard overdue table class cell: `text-muted-foreground/80` = **4.46:1** on white (5 nodes),
  from `OutstandingFeesTableDesktopBody.tsx:132,195`. Barely below 4.5, but a real AA failure.
- Platform shell badges use `text-muted-foreground/75` at 3xs (4 nodes) and the workspace chip is
  4.07:1 (above). The pattern is the same: lowering opacity on a passing token drops it below AA.

Fix: do not use `/80` for text; add a `--muted-foreground-subtle` that is solved for AA, or remove
the opacity modifier on table text.

### P2 — Global search promises entity search, delivers page navigation

The top bar and palette use `nav.globalSearchPlaceholder` (“Search students, sessions…”), but the
palette only searches modules/pages: typing `Rabia` (a seeded student) yields
`No matching pages found for "Rabia"`. `CommandPalette.tsx:112` is navigating commands only.
Either implement entity results or change the copy to “Search pages and modules…”. The current
promise is a trust failure on a high-frequency control.

### P2 — Mixed numeral systems and BiDi ordering

In one Arabic dashboard, the DOM contains **113 Arabic-Indic digits and 76 Latin digits**; examples:
`+100%` (Latin) beside `+٠%` (Arabic-Indic), pagination `1 / 3` rendered as **`3 / 1`**, and
currency codes flip sides (`PKR ١٬١٠٠`). The overdue table's `NaN` dates sit beside Arabic-Indic
day counts. This is not one bug but one class: numerals and currency/pagination need a single
locale policy and LTR isolation (`dir="ltr"`/`unicode-bidi: isolate`) where the value is a code.

### P2 — 10–11 px micro-text remains, and Nastaliq at that size is hard to read

`text-3xs` (11 px) has **159** source usages and `text-4xs` (10 px) 10; the dashboard renders
**120** elements at 11 px. On the Urdu mobile dashboard the 2.2 line-height is present (prior fix
verified), but Nastaliq glyphs at 11 px are materially harder to read than Latin at the same size.
The type-scale fix raised 2xs to 12 px but left the dense `3xs`/`4xs` steps. Raise the content
floor to 12 px (reserve 11 px for non-essential metadata) and re-check the Urdu/Persian cards at 375.

### P2 — Students and seven academic surfaces hide under “Academics”

On the dashboard, the sidebar shows only 9 top-level items; Students, Sessions, Enrollments,
Attendance, Hasanat Cards, Examinations, Question Bank, and Workshops are inside a collapsed
“Academics” group. On `/students` the group expands to 8 sub-items and pushes Finance/Accounting
behind the fixed footer. For a madrasa admin, Student is a daily destination; it costs an extra
click and is invisible on first use, especially on mobile (same collapsed group).

### P2 — Empty charts look like broken charts

“Enrollment Trends” with no series renders a flat line at 10 on a y-axis of **−4 … 10** with no
“no data” copy; “Attendance Rate” shows bare 0–100 axes. These read as rendering faults, not
empty states. The chart primitives should render a compact empty state (“No enrollment data for
this period”) rather than axes, and should not invent negative tick marks for a count series.

### P2 — Student registration opens with a destructive validation banner

[student-modal-1440.png](./screenshots/student-modal-1440.png) shows
“Select or create a student contact before saving.” as a red alert **before any interaction**.
`StudentForm.tsx:55` renders the alert whenever `contactId` is empty, not on submit/blur. It makes
a fresh form feel failed. Show a neutral helper until the first submit (or field blur), then the
error.

### P2 — Settings is a 2,554 px single column with a save button at the bottom

[settings-1440.jpg](./screenshots/settings-1440.jpg) combines language/region, notifications/SMTP,
and security in one General tab. “Save Settings” is only at the very bottom; “Save Mail Settings”
sits mid-card with different scope, and the left sub-nav scrolls away. A sticky save bar and
clearer per-section scope would reduce lost edits and “which save?” ambiguity.

### P2 — Admissions empty state is a dead end

`/apply` (open registrations disabled) shows a small “No admissions are open right now” under a
large blank page with no explanation, contact link, or return action. The document title was also
observed as “Welcome Back” rather than an admissions title. The raw dynamic key `nav.apply` is
missing from all four packs (`useBranding.ts:72` builds `nav.${matchedKey}`), so the page label can
render as a literal key. Add a next step (contact the madrasa / notify me) and a real nav key.

### P2 — Platform top bar is crowded and duplicates controls

[platform-dashboard-1440.png](./screenshots/platform-dashboard-1440.png): a workspace picker
truncated to “J…”, “Platform Console” wrapped in the bar, two global search affordances (sidebar
compact + top bar), a Copilot button, and two identical “Create New Madrasa” primary CTAs on the
same screen. The hierarchy is unclear at 1440 and collapses at 375 (above). Simplify the bar to
one search, one primary action, and an ellipsis menu for the rest.

### P3 — Overlay clipping and other polish

- Command palette list bottom row is clipped by the footer
  ([command-palette-1440.png](./screenshots/command-palette-1440.png)).
- Columns popover is clipped by the viewport bottom; no visible scroll affordance.
- Platform workspace card “Created date” is cut at 812 px.
- Login “Remember me” checkbox element is 16×16 (its label extends the hit area; verify).
- A transient “Sync error” badge appeared immediately after first-time setup once and did not
  reproduce on reload; recorded as unverified, not a finding.

---

## 4. What is already strong (protect it)

- **RTL mirroring is real.** Sidebar, cards, tables, drawers, and dates mirror correctly; the Arabic
  dashboard is not an LTR layout with translated strings.
- **Dark mode is coherent.** Surfaces, borders, shadows, charts, and semantic badges remain legible;
  the palette reads as one product. [dashboard-dark-1440.jpg](./screenshots/dashboard-dark-1440.jpg)
- **The detail drawer is well built.** Focus trap, tabs, sticky updated footer, blurred scrim,
  grouped contact channels, 44 px actions. [contact-drawer-1440.png](./screenshots/contact-drawer-1440.png)
- **The onboarding wizard is clear.** Five-step progress, selected industry card, live preview,
  focus ring on the first field. [platform-onboarding-1440.jpg](./screenshots/platform-onboarding-1440.jpg)
- **Empty/offline states are designed, not afterthoughts** — dashed empty trash with a clear action,
  offline toast, notification popover, and a functional command palette.
- **Tables carry the right tooling:** search, filters, show-deleted, view switch, column customiser,
  sort, pagination, status badges, bulk selection.
- **No captured page had horizontal overflow**, primary buttons/inputs hold 44 px, and warm LCP was
  0.6–1.8 s with CLS typically ≤0.06 (one 0.26 dark-load outlier attributed to a dev-server reload).

---

## 5. Reconciliation with the earlier reviews

| Prior item | Status in this pass |
|---|---|
| #1 palette contrast | **Verified visually and numerically** for text tokens; new opacity/tint regressions found (4.46 dashboard, 4.07 platform chip) |
| #2 print | Not re-exercised visually; existing print guards remain in place |
| #3 Escape overlay stack | Drawer closed with Escape while the page stayed put; no double-close observed |
| #4 session timeout | Not triggered (60 min); not verified visually |
| #5 skip link | Present in source; not exercised in the capture pass |
| #6 `BiDiText` | Names remain readable inside RTL; but page numbers/currency still reorder (`3/1`) |
| #7 Urdu leading | **Verified 2.2**; legibility at 11 px remains a concern |
| #8 Amiri scoping | **Re-opened**: runtime `--font-display` is still Amiri for English |
| #9 type scale | Live at 10/11/12 px; 10/11 px remains below the 12 px recommendation |
| #10 i18n strings | New dynamic-key gap: `nav.apply` missing in all packs |
| #11 axe coverage | Shell passes 9/9 but skips drawers; platform gate fails; populated dashboard has no test |
| #12 z-index | No raw z-index anomaly observed in captures; not exhaustively re-measured |
| #13 BiDi lint | Not re-run; captures show 0 horizontal overflow and mirrored layout |
| #14 checker scope | Not re-run |
| #15 status pills | No mis-styled status pill found in the sampled surfaces |
| #16 preview input | Not in captured surfaces |

---

## 6. Prioritised roadmap

**Now (release blockers / CI)**
1. Fix `formatDate` locale digits (P0) and add ar/fa/ur/en date assertions.
2. Fix the platform workspace-chip contrast and make `a11y-platform-workspaces` green; add an
   `aria-label` to the compact search trigger.
3. Fix the contacts `Name` width (`width: 0` → auto) and add a 1440/1920 layout test.
4. Fix the platform mobile header layout (compact wordmark, one row) and hide/relocate the
   overflow controls.
5. Hydrate language from the workspace so it survives a fresh browser.

**Next (1–2 weeks)**
6. Dashboard consolidation: priority order, fewer default widgets, merge receivables lists, fix
   mobile KPI truncation, move Print/Customize into the header.
7. Stop the mobile auto-scroll on module entry; keep scroll-to-tab for user-initiated changes only.
8. Fix the runtime display font stack; raise the 10/11 px content floor; re-check Urdu/Persian at 375.
9. Raise row action targets to 44 px; remove `/80` text opacity; solve the subtle-text token.
10. Correct the global search promise (copy or entity results); fix `nav.apply` and the admissions
    dead end.
11. Improve the student form's validation timing; sticky settings save bar.

**Later (structural)**
12. Extend the axe gate to populated dashboards/forms and the full platform shell (not just
    `#main-content`), with a seeded tenant.
13. Add visual-regression baselines for six core surfaces plus the platform shell.
14. Design-system pass on density, dashboard hierarchy, and platform header IA.

---

## 7. Appendix — how to reproduce

```bash
# fixture + sessions
cd e2e
node scripts/capture-ui-ux-review.mjs --provision
node scripts/capture-ui-ux-review.mjs --session
node scripts/capture-ui-ux-review.mjs --capture-core
node scripts/capture-ui-ux-review.mjs --capture-locales
node scripts/capture-ui-ux-review.mjs --capture-breadth
node scripts/capture-ui-ux-review.mjs --capture-states
```

```bash
# gates referenced above
cd e2e
npx playwright test tests/a11y/a11y-shell.spec.ts --project=a11y --reporter=list
npx playwright test tests/a11y/a11y-platform-workspaces.spec.ts --reporter=list
```

Raw evidence (all 123 screenshots, `manifest.json`, axe JSON, logs) is under
`.logs/ui-ux-review-2026-10-30/`. The harness is review tooling only and is not wired into CI.

> No product code was changed by this review. Fixes require a separate approved plan with TDD,
> the relevant skills (`mms-ui-ux-design`, `mms-module-work`, `mms-form-architecture`,
> `mms-i18n-completeness`, `mms-a11y-smoke`), and the standard completion audit.
