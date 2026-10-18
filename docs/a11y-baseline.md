# Accessibility (a11y) Baseline

The axe gate runs in the normal E2E job as `e2e/tests/a11y-shell.spec.ts` — this is
the executable form of the `mms-a11y-smoke` skill, which previously described the
check but had no tooling installed to run it.

## What the gate does

- Sweeps the app shell, one Work surface (Contacts) and one Setup surface
  (Settings) at **375px** and **1440px**, plus an **RTL** pass at 1440px.
- Runs axe-core with the **WCAG 2.1 A + AA** tag set as the automated floor, extended
  with the **`wcag22aa` tag** (`e2e/helpers/a11y.ts` — currently axe's `target-size`
  rule, SC 2.5.8). The design target is **WCAG 2.2 AA** (`mms-ui-ux-design.mdc` §3);
  2.2-specific success criteria axe does not automate (Focus Appearance 2.4.11,
  Redundant Entry 3.3.7, Accessible Authentication 3.3.8) are covered by manual
  review, not by this gate.
- **Fails** on `serious` / `critical` violations that are not baselined.
- **Reports without failing** on `moderate` / `minor` (these are logged per run).

Contrast rules are the reason this lives in Playwright rather than a jsdom unit
test: colour contrast and focus visibility need a real rendered browser.

## Adopting the gate: why a baseline exists

Switching the gate on for the first time surfaced pre-existing violations. The
contrast one turned out to be a **design-token defect**, not a markup bug: the light
palette's semantic tokens could not reach AA in any of the three roles they serve.
Blocking CI on it on day one would have meant abandoning the gate, so it was
baselined — and it has since been fixed at the token layer (Finding 1). The entry
remains only until an axe run confirms it.

So `A11Y_BASELINE` in `e2e/helpers/a11y.ts` lists the rule IDs known to be
failing at adoption:

| Rule | Status | Notes |
|---|---|---|
| `color-contrast` | **RESOLVED — entry removed** | Fixed in the branding contrast pipeline. See Finding 1. |
| `aria-hidden-focus` | **RESOLVED — entry removed** | The `ProgressBar` ARIA conflict was the cause. See Finding 2. |

**The baseline is now empty.** Every serious/critical WCAG 2.1 A/AA violation fails
the build. If a new one appears, fix it — do not re-baseline.

This is a **ratchet**, in the same spirit as `scripts/check-migration-indexes.mjs`:
any rule *not* listed fails the build, so the codebase cannot get worse, and
baselined findings are printed on every run (and attached as test annotations) so
they stay visible instead of quietly forgotten.

**Do not add a baseline entry to unblock a change.** Fix the change.

## Finding 1 — `color-contrast` (serious)

One root cause, three observed sites. All are `text-primary` rendered too small or
on a tinted surface:

| Element | Where |
|---|---|
| `<span class="block text-sm font-semibold">General</span>` | Settings nav, active tab (`ResponsiveAccordionTabTrigger.tsx`) |
| `<span class="block text-sm font-semibold">Work</span>` | Settings nav, active tab (same component) |
| `<span class="… rounded-full text-2xs font-semibold bg-primary/10 text-primary …">10/38</span>` | Work-directory count badge |

At 14px semibold the text is **not** "large text" under WCAG (that needs ≥18.66px
bold or ≥24px), so it must reach **4.5:1**, not 3:1.

**Status: RESOLVED.** The `color-contrast` entry has been deleted from
`A11Y_BASELINE`, and the gate passes without it.

### Resolution

This was never three sites — it was one token-level defect with a very wide blast
radius, and it lived in the **runtime branding pipeline**, not in the CSS the
settings nav happened to use.

Worth stating plainly, because it cost real time: `src/index.css` is *not* the
palette the app renders. `buildBrandingCssVariables` overwrites all 34 semantic
tokens at runtime (see `BRANDING_THEME_VARIABLES`), so reasoning from the
stylesheet gives the wrong answer. The axe report is what settled it — printing
axe's own measured colours showed the test tenant resolving
`--primary` to `#db9d00` (2.37:1 on white) even after the CSS had been fixed.

The underlying mistake: every semantic token serves three roles —

1. a solid fill — `bg-primary` with `text-primary-foreground` on it;
2. text/icons — `text-primary` on `--card` / `--background`;
3. text/icons on the token's own tint — `bg-primary/10 text-primary`, the standard
   chip pattern (188 usages at `/10`, plus `/15` and `/20` variants).

Measured against the pre-fix palette with the repo's own `getContrastRatio()`:

| Pair | Before | Now |
|---|---|---|
| `--primary-foreground` on `--primary` (every default Button label) | 2.61:1 | 5.91:1 |
| `--primary` as text on `--card` | 2.61:1 | 5.91:1 |
| `--destructive` as text on `--card` | 3.76:1 | 6.52:1 |
| `--success` as text on `--card` | 3.52:1 | 5.94:1 |
| `--warning` as text on `--card` | 3.16:1 | 5.96:1 |
| `--primary` on its own `/15` tint | 3.5:1 | 4.78:1 |
| `--ring` vs `--card` (WCAG 1.4.11, needs 3:1) | 2.61:1 | 5.91:1 |
| dark `--destructive` as text on `--card` | **1.66:1** | 5.29:1 |
| `--muted-foreground` on `--muted` | 3.95:1 | 4.61:1 |

Two structural fixes, not a spot patch:

- **Light theme** tokens are solved so all three roles clear 4.5:1 simultaneously.
  Roles (1) and (2) reduce to the same luminance constraint; role (3) is the
  binding one, because a tint of the token lightens the surface it is read
  against. The values therefore sit near Tailwind's **700** step, not 500/600 —
  `amber-600` (3.19:1), `emerald-600` (3.77:1) and `orange-600` (3.56:1) all fail
  AA with white text, let alone on a tint.
- **Dark theme** already used the correct "light solid + dark foreground" shape for
  `--primary`; `--destructive`, `--success`, `--warning` and `--info` were migrated
  to match, which is what fixed the 1.66:1 `text-destructive`.

A few resting chips used a tint stronger than one hue can satisfy (`/20`, `/30`),
and those were normalised to `/10`–`/15`. `dark:bg-<role>/20` chips became `/10`.

**The runtime fix.** `ensureAccessibleFillSurface` used to walk a colour's
lightness *down* and stop as soon as **either** white **or** dark text passed on
the fill. For a mid-tone brand colour that accepts a dark label it stopped at step
zero, keeping a bright fill — which satisfies role (1) and destroys roles (2) and
(3). It now walks in the direction its theme requires (light themes must reach a
fill carrying *white* text; dark themes one carrying *dark* text) and only stops
when the fill, both surfaces and the token's own resting tint all clear 4.5:1.
`buildSemanticStatusTokens` and `maxRestingTintByMode` follow the same contract.

**Enforcement:** `packages/shared/src/brandingTheme.test.ts` asserts all three roles
for every curated preset **and** for light brand colours (`#d09611`, `#facc15`,
`#a3e635`) in both modes — the light-brand shape is what actually shipped the
failure, and no curated preset covers it.
`apps/frontend/src/__tests__/designTokens.contrast.test.ts` holds the same line for
the CSS fallback palette, and `e2e/helpers/a11y.ts` now prints axe's measured
fg/bg/ratio so the next occurrence of this class of bug is diagnosable from the
failure output alone.

**Verification:** the gate runs clean across 15 audit contexts — 5 routes × 2
viewports, 4 overlay dialogs, and RTL — with the `color-contrast` baseline entry
deleted. Overlay audits were added at the same time because the previous
"best-effort drawer" step silently no-opped on a tenant with no rows and reported
success; skipped audits now log that they were skipped.

## Finding 2 — `aria-hidden-focus` (serious, intermittent)

`aria-hidden="true"` must not wrap focusable content: a keyboard user can tab into
something a screen reader cannot announce.

Observed only on the dashboard and only on some runs, which points at
data-dependent widget rendering (KPI/widget cards appear once their data lands).

### A real ARIA conflict was found and fixed while investigating

`ProgressBar` (the SSOT progress/rate bar) spread `...props` onto the same element
that carried `role="progressbar"` + `aria-valuenow`. Eight call sites — attendance,
accounting (×3), sessions (×2), profile, question-bank (×2), dashboard charts —
pass `aria-hidden="true"` to mark a bar *decorative*, so those elements both
declared a widget **and** hid it from assistive tech. Two consequences:

1. An `aria-hidden-focus` violation at every one of those sites.
2. The progress value was never announced — the parent rows convey it only
   visually (their `aria-label` sits on a role-less `<div>`, which AT ignores).

The component now drops the widget role when marked decorative, so the two ARIA
contracts cannot contradict. Covered by
`apps/frontend/src/components/ui/ProgressBar.test.tsx`.

**Reviewed (2026-10-14) — no change needed.** The bars flagged here are *decorative*:
each call site already renders the measured value as adjacent visible text (e.g. the
balance-sheet row's `name: amount` spans; the profile card's `Completeness NN%`).
Removing `aria-hidden` and adding an `aria-label` would duplicate that for screen
readers, so honouring `aria-hidden` — which `ProgressBar` does by dropping the widget
role — is the correct end state, not a stopgap. Residual (optional): a few sites put
an `aria-label` on a role-less wrapper `<div>` (e.g. `AccountingDashboardSnapshots`),
which AT ignores — dead but harmless.

### Status: RESOLVED — entry deleted

The `ProgressBar` fix described above is the cause, on the strength of the absence.
After it landed: **12 clean full-gate runs** (each auditing the dashboard twice) plus
a **16-audit focused reload loop** on the dashboard — roughly 40 clean dashboard
audits, where the pre-fix rate was ~1 in 6. If nothing had changed, ~40 consecutive
cleans would be ~0.1% likely.

That is a statistical argument rather than a reproduction, and it is worth being
explicit about the difference. Two things make it good enough to act on:

- The original report's selector was **misleading**, which is what stalled the
  attribution: the helper joined axe's `node.target` array with a space, and that
  array can hold several selectors for a multi-element target. It produced
  `.min-h-card-sm > .flex-shrink-0[aria-hidden="true"]`, which reads as one CSS
  selector but was two separate elements. The helper now joins with `>>`.
- The failure path is better instrumented: a firing run prints the offending node's
  `html:` plus axe's measured values. So if it does recur, the output names the
  element instead of restarting the investigation.

If it recurs, the right move is to fix it, not to re-add the entry.

### Related follow-up — reviewed, no change (see the note above)

The eight call sites pass `aria-hidden` on genuinely decorative bars whose values are
also shown as adjacent text, so exposing the bar would duplicate the announcement.
`ProgressBar` already drops the widget role when `aria-hidden` is set, which resolves
the original ARIA conflict without losing information.

## Regenerating the baseline

After a deliberate UI change, list current findings without failing:

```bash
cd e2e && A11Y_COLLECT=1 npx playwright test tests/a11y-shell.spec.ts --reporter=list
```

Then update `A11Y_BASELINE`, removing entries that are genuinely fixed. It is
currently **empty** — keep it that way unless something genuinely cannot be fixed
in the change that surfaced it.

## Widening coverage

The smoke covers the shell plus four Work/Setup surfaces, and audits an **overlay**
on each — the column-customiser dialog, which needs no seed data, and, best-effort,
a directory row's detail drawer. Overlays are covered because they are where the
focus trap, backdrop, z-index scale and Escape ownership meet, and because they
portal to `<body>`, outside the tree the shell rules reach. Most a11y breakage comes
from shared primitives (`AppLayout`, `FormModal`, `Table`, buttons, inputs), which
this exercises. Add a route to `AUDIT_ROUTES` when changing those primitives, or
when adding a new top-level surface — not per module, which would multiply runtime
without changing the class of regressions caught.

**Skipped audits must say so.** The drawer step originally returned silently when
the tenant had no rows, so it reported success for months without ever opening
anything. Any conditional audit now logs when it skips:

```
[a11y] students (Work, dense table) @ 1440px (ltr): no drawer trigger found — skipped
```

### Known blind spot: the tenant has no data

`bootstrapAuthenticatedTenant` creates an **empty** tenant, so everything the gate
audits is a shell, an empty state, or a dialog that needs no records. Every
data-dependent module surface — populated tables, detail drawers, charts, metric
widgets, wizard steps — is never rendered and therefore never checked.

That is a real limit on what a green gate means, and it is not theoretical: while
chasing the `ProgressBar` follow-up I found two places where meaningful data was
hidden from assistive tech inside a populated component
(`ClassCard`'s capacity row, `Step4ClassAssignment`'s remaining-spots block). Neither
could ever have surfaced here, because neither component renders without records.

Closing it means seeding the tenant before the sweep. **Partially closed:**
`e2e/tests/a11y/a11y-populated.spec.ts` provisions a tenant via the API, runs the backend
`seed-20-contacts.ts` + `seed-20-students.ts` + `seed-20-sessions.ts` + `seed-20-faculty.ts` +
`seed-20-invoices.ts` (20 deterministic, idempotent records each), and audits the **populated** contacts
Work table (incl. a best-effort row detail drawer) at 1440 and 375, the populated students / sessions /
faculty / finance Work tables (+ drawer) at 1440, the dashboard's populated metric widgets at 1440, and
the new-enrollment wizard's opening step at 1440.

Those populated audits now **gate** — the `advisory: true` flag was dropped after the first clean passes
(2026-10-14): serious/critical WCAG 2.1 A/AA violations fail the build, same as the shell sweep. The
precondition — that rows genuinely rendered — is a hard assertion, so an accidentally-empty page fails
loudly instead of producing a meaningless green.

**Still to cover** (each needs its own seed→audit): richer charts/metrics and the remaining enrollment
wizard steps (the gate currently covers the wizard's opening student step). The old UI-helper path
(`registerStudentJaneDoe`, …) remains too fragile to reuse for seeding.

## Adjacent guards

Two other suites protect things this one cannot see:

- `e2e/tests/print-documents.spec.ts` asserts what is actually visible under print
  media (`page.emulateMedia({ media: 'print' })`). It is data-free and **not** tagged
  `@local-only`, because CI `grepInvert`s that tag — a guard CI skips is not a guard.
- `apps/frontend/src/__tests__/printStyles.test.ts` asserts the same invariant
  against `index.css` directly, so it holds even when the e2e suite is filtered.

