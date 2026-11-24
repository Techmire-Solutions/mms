# UI/UX Review — Resolution

What changed for each of the 16 findings in [`ui-ux-review.md`](./ui-ux-review.md),
plus the verification run and the items that still need a rendered-browser check.

**Verification status:** frontend/shared/e2e typecheck, ESLint, 595 test files
(1,792 tests), the agent-standards gate, the BiDi sweep and the production build all
pass. The one thing NOT verified here is the axe gate, which needs a running
backend + Postgres + Playwright — see [Residual](#residual-work).

---

## Summary

| # | Finding | Pri | Status |
|---|---|---|---|
| 1 | Light-theme palette fails WCAG AA as text | P0 | **Fixed** — tokens re-solved; 35 new tests |
| 2 | Printing an ID card yields a blank/black page | P0 | **Fixed** — print CSS scoped, print hooks added |
| 3 | Escape closes every open overlay | P1 | **Fixed** — layer registry + focus-ownership guard |
| 4 | `SessionTimeoutModal` outside the overlay system | P1 | **Fixed** — rebuilt on `Modal`, non-dismissible |
| 5 | No skip link in the tenant shell | P1 | **Fixed** — shared `SkipToContentLink` in both shells |
| 6 | `dir="auto"` used once in 1,941 files | P1 | **Fixed** — `BiDiText` + applied at SSOT render sites |
| 7 | Urdu line-height below the documented 2.2 | P2 | **Fixed** |
| 8 | `--font-display` resolves to a generic serif | P2 | **Fixed** — Amiri scoped to `[lang=ar/ur]` |
| 9 | 217 usages of ≤11px text | P2 | **Fixed** — 10/11/12px floor |
| 10 | 29 hardcoded English strings | P2 | **Fixed** — 22 keys × 4 locales + dev warning |
| 11 | axe gate covers only the shell | P2 | **Fixed** — 5 routes + detail drawers, LTR & RTL |
| 12 | z-index scale partially bypassed | P3 | **Fixed** — 0 raw values remain |
| 13 | BiDi ESLint rule misses `cn()` | P3 | **Fixed** — composer support + 8 rule tests |
| 14 | Skill checker scans 21% of the tree | P3 | **Fixed** — 2,539 files, mirrors synced |
| 15 | Hand-rolled status pills | P3 | **Reviewed, no change** — mostly decorative (see below) |
| 16 | Decorative preview input is tabbable | P3 | **Fixed** |

Plus **one additional bug surfaced while fixing #9** that the review had missed: the
sub-xs type scale was dead CSS. See
[Findings 7–9](#findings-79--typography) below.

---

## Update — the axe gate was run, and it found the rest of the story

The first pass fixed `src/index.css`. That turned out to be the **fallback** palette:
`buildBrandingCssVariables` overwrites all 34 semantic tokens at runtime (see
`BRANDING_THEME_VARIABLES`), so the running app never used the values I had just
solved. Running the axe gate is what exposed this — the test tenant resolved
`--primary` to `#db9d00` (**2.37:1** on white) even after the CSS was fixed.

That is recorded here rather than quietly amended above, because the mistake is the
interesting part: I reasoned from the stylesheet and asserted a fix without running
the one check that reads the real palette. The gate already existed and was one
command away.

**The actual defect.** `ensureAccessibleFillSurface` walked a colour's lightness
*down* and stopped as soon as **either** white **or** dark text passed on the fill.
A mid-tone brand colour that accepts a dark label therefore stopped at step zero and
shipped a bright fill — which satisfies the fill role and destroys the text role. It
now walks in the direction its theme requires (light themes must reach a fill
carrying *white* text, dark themes one carrying *dark* text) and stops only when the
fill, both surfaces, and the token's own resting tint all clear 4.5:1.

Measured on the amber test tenant, before → after:

| | Before | After |
|---|---|---|
| `--primary` (light) | `#db9d00` — 2.37:1 on white | `#795b16` — 6.32:1 |
| `--primary` (dark) | — | `#d0a749` — 8.01:1, dark label 7.00:1 |

`buildSemanticStatusTokens` had the same flaw for all four status tokens, in both
modes — including a **1.83:1** dark `--destructive`.

**Why the existing tests missed it.** `brandingTheme.test.ts` asserted contrast for
*fill/foreground pairs only* — never the text role, never the tint role. It passed
throughout. It now asserts all three roles for every curated preset **and** for light
brand colours (`#d09611`, `#facc15`, `#a3e635`), because every curated preset is a
*dark* brand colour and none of them reproduces the failure that actually shipped.

**Result: the `color-contrast` baseline entry is deleted.** The gate passes without
it across 15 audit contexts, which proves nothing was being masked.

### Two things fixed in the gate while verifying

1. **It now prints axe's measured colours** (`fg on bg = N:1`). Without them the
   report names the element but not the numbers, and the numbers are what identified
   the runtime palette as the culprit.
2. **The overlay audit no longer silently no-ops.** The "best-effort drawer" step
   looked for a table row; the test tenant is created empty, so it skipped every run
   and reported success — the same silent-pass failure I had criticised in the skill
   checker. Data-independent overlay audits (the column-customiser dialog) always run
   now, and any skip logs that it skipped. The drawer audit stays best-effort and says
   so:

```
[a11y:collect] students (Work, dense table) @ 1440px (ltr) (dialog) []
[a11y] students (Work, dense table) @ 1440px (ltr): no drawer trigger found — skipped
```

---

## Finding 1 — the palette (the big one)

The review called this out as ~1,274 text usages plus every primary button. Fixing
it properly meant recognising that each semantic token serves **three** roles, and
that the third is the binding one:

1. a solid fill — `bg-primary` with `text-primary-foreground` on it;
2. text/icons — `text-primary` on `--card` / `--background`;
3. text/icons on the token's **own tint** — `bg-primary/10 text-primary`, the chip
   pattern (188 usages at `/10`, plus `/15` and `/20`).

Roles (1) and (2) reduce to the same luminance constraint, which is why one value
can serve both. Role (3) is stricter than either, because a tint of the token
lightens the surface the token is read against — a token tuned against white alone
still fails on its own chip.

Measured with the repo's own `getContrastRatio()`:

| Pair | Before | After |
|---|---|---|
| `--primary-foreground` on `--primary` (every default Button label) | 2.61:1 | 5.91:1 |
| `--primary` text on `--card` | 2.61:1 | 5.91:1 |
| `--destructive` text on `--card` | 3.76:1 | 6.52:1 |
| `--success` text on `--card` | 3.52:1 | 5.94:1 |
| `--warning` text on `--card` | 3.16:1 | 5.96:1 |
| `--primary` on its own `/15` tint | ~3.5:1 | 4.78:1 |
| `--ring` vs `--card` (WCAG 1.4.11, needs 3:1) | 2.61:1 | 5.91:1 |
| dark `--destructive` text on `--card` | **1.66:1** | 5.29:1 |
| `--muted-foreground` on `--muted` | 3.95:1 | 4.61:1 |

**Light theme.** Tokens now sit near Tailwind's **700** step rather than 500/600.
That is not a stylistic preference: `amber-600` (3.19:1), `emerald-600` (3.77:1)
and `orange-600` (3.56:1) all fail AA even with white text, and all fail as text on
their own tints.

**Dark theme.** Dark mode *already* used the correct "light solid + dark foreground"
shape for `--primary`; `--destructive`, `--success`, `--warning` and `--info` were
still mid-tones. Migrating them to the same shape is what fixed the 1.66:1
`text-destructive` — no new pattern was invented.

**Related defects fixed while in there.** Four places paired a `-foreground` token
with a *tint* rather than a solid — white-on-near-white, i.e. invisible text:
`LlmConfigTestResultPanel.tsx:30`, `LlmConfigModalBody.tsx:176`,
`BrandColorContrastMatrix.tsx:73,112`, and `AccountProfileContactTab.tsx:59`.

**Enforcement:** `apps/frontend/src/__tests__/designTokens.contrast.test.ts` (35
tests) parses `src/index.css` and asserts every role against every surface, its own
tint, and its fill in both themes, plus the type-scale floor. It fails if a token is
lightened without re-checking.

**Chips too strong for any single hue.** A resting `/20`–`/40` tint of a token
behind that same token's text cannot reach AA for any value that still works as a
fill. Those few sites were normalised to `/10`–`/15` (and `dark:bg-<role>/20` →
`/10`). The rule is documented in `index.css`: **tints above `/15` must use
`-foreground`, not the role colour.**

## Finding 2 — print

Removed the four genuinely harmful selectors from `@media print`
(`.shadow-sm`, `.shadow-xl`, `.border-b.border-border`, `[role="group"]`) — the
first two were deleting the ID cards outright, and `[role="group"]` is legitimate
Radix content. Kept `button`/`input`/`select`, which is what suppresses action
chrome in the twelve in-document print flows and was never the problem.

Added two explicit print hooks rather than more blanket selectors:

- `data-overlay-backdrop` on every overlay scrim (Modal, DetailDrawerShell,
  alert-dialog, both sidebars, both command palettes, loading chrome). Overlays are
  portalled to `<body>`, outside the app tree, so the existing rules never reached
  them — and `print-color-adjust: exact` was forcing the `bg-sidebar/90` scrim to
  print as a solid dark page.
- `data-print-unclamp` on modal wrappers/panels/body and the ID-card containers, so
  `position: fixed`, `max-height` and `overflow-y-auto` stop clipping the document
  to one scroll viewport.

## Finding 3 — Escape ownership

`hooks/useOverlayBehavior.ts` registered its own `window` keydown listener and
closed unconditionally, so a confirm dialog inside a detail drawer closed both.
New `lib/overlayStack.ts` keeps a module-level layer stack; only the topmost layer
responds. A second guard covers Radix overlays, which portal to `<body>` and are not
in the registry: if focus currently sits outside this overlay's container, a nested
layer owns the key.

Both mechanisms are needed. The focus guard alone fixes the reported case, but if
focus falls back to `<body>` (clicking inert chrome) only the stack keeps Escape
single-target — `useOverlayBehavior.test.tsx` has a test for exactly that, and it
fails if the stack check is removed.

## Finding 4 — session timeout modal

Rebuilt on the shared `Modal`, which supplies the focus trap, initial focus, body
scroll lock and the token-backed backdrop it previously lacked while still
declaring `aria-modal="true"`. Added a `dismissible` prop to `Modal` (and to
`useOverlayBehavior`) because a session warning must not be dismissible — but a
non-dismissible overlay still joins the layer stack, so it blocks Escape from
reaching overlays beneath it. `z-[120]` and `bg-black/50` are gone.

## Finding 5 — skip link

Extracted `components/ui/SkipToContentLink.tsx` and used it in **both** shells,
replacing the inline copy in `PlatformPageShell`. The tenant app had the
`#main-content` target but no link — the wrong way round, since that is the surface
every user opens daily.

## Finding 6 — `dir="auto"`

New `components/ui/BiDiText.tsx`, applied at the three SSOT render points
(`DirectoryCardHeader`, `TableCellLink`, `PersonDetailHeroCard`) plus the students
desktop name cell. Logical *classes* were already enforced; text *direction* was
not, so a Latin name in the RTL UI (or an Urdu name in the English UI) still
resolved its base direction from the surrounding UI and moved trailing punctuation
to the wrong side.

## Findings 7–9 — typography

- Urdu `line-height` 1.8 → **2.2**, matching the `mms-ui-ux-design` contract for
  Nastaliq (deep descenders, stacked letterforms).
- `--font-display` moved out of the global `:root` and scoped to `[lang="ar"],
  [lang="ur"]`. Amiri is only fetched for those locales, so naming it globally made
  English and Persian brand text fall back to a generic **serif** — the mobile
  header, sidebar brand and login headline were all affected.
- Type floor raised: `4xs` 9px → 10px, `2xs` 10px → 12px. `2xs` now coincides with
  `text-xs`; that is deliberate, 12px being the smallest size worth shipping for real
  content. The stale ESLint `no-restricted-syntax` message was updated to match.

### Bonus bug found here: the sub-xs type scale was dead CSS

While changing these values I checked the built stylesheet — and none of the three
utilities existed:

```
$ grep -E '\.text-(2xs|3xs|4xs)\{' dist/assets/*.css
(no output)
```

**Tailwind v4's font-size namespace is `--text-*`, not `--font-size-*`.** The tokens
had been declared as `--font-size-2xs` / `-3xs` / `-4xs`, which Tailwind does not
recognise, so `text-2xs`, `text-3xs` and `text-4xs` generated **no CSS at all**. All
**217** call sites were inert: micro-labels, timestamps, hex codes and badges
silently inherited whatever font-size happened to surround them. The review counted
those 217 usages and reported the sizes as too small; in reality nothing was being
sized, which is why the 9px/10px figures never showed up as a legibility complaint.

Fixed by moving the declarations to `--text-*` with explicit `--text-*--line-height`
values, and verified in the build output:

```
.text-2xs{font-size:.75rem;line-height:var(--tw-leading,1rem)}
.text-3xs{font-size:.6875rem;line-height:var(--tw-leading,.9375rem)}
.text-4xs{font-size:.625rem;line-height:var(--tw-leading,.875rem)}
```

**This is a behaviour change, not just a value change:** those 217 sites now render at
10/11/12px instead of inheriting. Most were previously rendering *larger* than
intended, so this tightens dense UI (a layout-shift risk worth the visual pass noted
in [Residual work](#residual-work)). The same class of mistake is worth checking
elsewhere — a typo'd namespace fails silently, so any custom `@theme` token should be
confirmed present in the built CSS.

## Finding 10 — i18n

22 new keys × 4 locales (en/ar/ur/fa), inserted at their sorted positions rather
than appended. Three keys the review would have added already existed with suitable
values (`sessions.budget.totalIncome/totalExpenses/netBalance`), so they were reused
rather than duplicated.

Reality was larger than the review's "29 hardcoded strings": `BudgetTab` alone had
15 (the overview labels, section titles, empty states, both modal titles, the
delete-confirm copy, `Cancel`/`Save`/`Delete`/`Amount`), and `WorkTaskToolbar` had 3
rather than the 1 reported. `InstitutionSetupAddressSection` (5), `FacultyManagementTab`,
`ModuleColumnCustomizer`, `TemplateEditorTableSection` and `CommandPalette` complete
the set. Non-translatable items were left alone: `alt="Logo"`, `placeholder="TCH-"`,
example URLs, and the developer-only Typst/Zoho export titles.

Also added a dev-only missing-key warning in `TranslationContext`: `translateApp`
falls back to returning the raw key, so a gap ships as literal
`students.idCard.title` text. Verified live — it caught `common.commandPalette`
before the key existed.

Key parity after the change: **7,241 keys × 4 locales, 0 missing.**

## Finding 11 — axe coverage

`e2e/tests/a11y-shell.spec.ts` now sweeps 5 routes instead of 3 (adding a dense
table and a money module), audits a **detail drawer** at 1440px and again in RTL,
and dismisses it with Escape — which double-serves as an end-to-end check of the
Finding 3 fix. Drawer opening is best-effort so a tenant with no seed data cannot
fail the gate.

## Findings 12–14, 16 — enforcement

- **z-index:** 0 raw numeric values remain in non-test source. Added the missing
  `--z-index-raised: 30` step (its absence is why a raw `z-30` had crept in) and
  documented why `dropdown`/`popover` intentionally share 70.
- **BiDi ESLint rule:** now walks class-composer calls (`cn`, `clsx`, `classNames`,
  `cva`, `twMerge`, `tv`), including nested logical/conditional/array/object shapes
  and `clsx`'s object-key form. Two bugs surfaced and were fixed during this: it
  double-reported `cn()` inside `className` (both visitors matched), and its `\b`
  pattern matched `right-2` inside `slide-in-from-right-2` — a Radix enter
  animation that is legitimately physical, and the source of 12 false positives.
  `src/__tests__/noPhysicalDirectionalClasses.test.ts` locks in both.
- **Skill checker:** default scope widened from `src/components` (404 files) to the
  whole tree (2,539 files), test files skipped, and the same token-boundary fix
  applied (its `rounded-l` pattern had been matching `rounded-lg`). Mirrors synced
  and the standards gate passes.
- **Preview input:** `tabIndex={-1}` + `aria-hidden` on the decorative mock search.

## Finding 15 — deliberately not changed

The review flagged 17 files hand-rolling tinted pills. Inspected individually: the
overwhelming majority are decorative, not status — a branding corner-style selector,
a welcome banner, an avatar, `FilterChips`. `StatusBadge`/`SEMANTIC_BADGE` remain the
SSOT for status (109 files import it). Forcing these onto `StatusBadge` would
misrepresent decorative tinting as status semantics, so no change was made. The two
borderline cases (`AuthStatusBanner`, `AcademicReportClassRankings`) do not currently
model a status vocabulary.

---

## Verification run

| Check | Result |
|---|---|
| `apps/frontend` typecheck | pass |
| `packages/contracts` typecheck | pass |
| `e2e` typecheck | pass |
| `apps/frontend` ESLint (`--quiet`) | pass — 0 errors, 0 BiDi violations under the **strengthened** rule |
| `apps/frontend` vitest | **596 files / 1,813 tests pass** (0 failures) |
| `packages/contracts` vitest | **171 files / 1,229 tests pass** |
| `scripts/verify-rules-integrity.mjs` | pass — 38 skills, 21 rules |
| `scripts/check-code-norms.mjs` | pass — includes the new inert-`@theme`-token check at baseline 0; verified to **exit 1** when `--font-size-*` is reintroduced |
| BiDi sweep (2,539 files) | pass — 0 violations |
| `vite build` | pass |
| Built-CSS assertions | `text-2xs/3xs/4xs` emit at 12/11/10px; all 10 `z-*` tokens emit their intended values; the print block contains none of the harmful selectors and both new hooks |
| **`e2e/tests/a11y-shell.spec.ts` (axe, WCAG 2.1 + 2.2 A/AA)** | **pass with the `color-contrast` baseline entry DELETED** — 15 audit contexts (5 routes × 2 viewports, 4 overlay dialogs, + RTL), zero violations of any severity. Note the blind spot above: the tenant is empty, so module surfaces that need records are not covered. |
| `brandingTheme.test.ts` three-role assertions | pass in both modes for every preset + light-brand colours; confirmed to **fail** (2 tests, dozens of pairs) before the pipeline fix |
| `designTokens.contrast.test.ts` | 39 pass; confirmed to **fail** when a token, the Urdu leading, or the Amiri scoping is reverted |
| `printStyles.test.ts` | 9 pass; confirmed to **fail** when `.shadow-sm` returns to the print hide-list |
| `useOverlayBehavior.test.tsx` | 7 pass; confirmed to **fail** without the layer guard |
| `noPhysicalDirectionalClasses.test.ts` | 8 pass |

Regression tests were checked for vacuity: each was re-run against the un-fixed code
and confirmed to fail. (The first version of the Escape test passed for the wrong
reason — the focus guard masked it — which is why the `<body>`-focus case exists.)

One full-suite run during this work reported a single failure while a production build
ran concurrently and transform time was ~17× normal; two subsequent clean runs
(1,804/1,804) did not reproduce it. Treated as a load-induced flake rather than a real
defect, and recorded here rather than quietly discarded.

---

## Residual work

1. **The visual pass cannot be done from this environment.** Items 2–4 below were
   *supposed* to be "look at it and confirm it is acceptable", and I could not do
   that: I have no image input, so I cannot view a screenshot. What could be verified
   without pixels was verified — the axe gate (contrast, roles, hierarchy), the print
   probe (computed `display` under print media), computed styles — but "does the
   darker amber look right" is a judgement no assertion makes. Someone with eyes
   needs to look before release.
2. **Visual review of the new palette.** Two layers changed and both are
   product-visible: the CSS fallback (amber `#d09611` → `#825e0b`) and, more
   importantly, the *runtime* palette generated by the branding pipeline, which now
   darkens any brand colour that cannot carry white text. Every tenant sees the
   second one. Worth a look across the curated presets plus a real tenant's logo —
   it is enforced by tests, but that does not make it the look you want.
3. **Visual review of the now-live type scale.** This is the larger of the two
   visual changes. 217 sites that previously inherited their font-size now render at
   10/11/12px — mostly *smaller* than they were, which tightens dense tables and
   cards. Bounded risk (smaller text rarely overflows) but it is a layout change
   across many surfaces.
4. **Urdu/Dark mode manual pass.** The Nastaliq line-height and the dark semantic
   migration are reasoned from metrics, not seen rendered. Worth a look at 375px in
   Urdu and in dark mode with the new `--destructive`/`--info`. The *rules* behind
   them are now asserted (see Update 3) — what still needs eyes is whether they read
   well, not whether they apply.

Print verification and the theme-namespace audit are no longer on this list — both
are automated guards now.

---

## Update 3 — the silent-failure class is guarded

Residual item 5 was the interesting one: the `--text-*` bug was caught only because
I happened to diff the built stylesheet by hand. A wrong `@theme` namespace produces
no CSS, no warning and no error, so it fails silently — worth a guard, and it turned
out to be cheap.

`scripts/check-code-norms.mjs` (already run in CI as `pnpm run check:code-norms`)
gained a check for **inert `@theme` tokens**, baseline zero.

The list is empirical rather than guessed. I compiled a probe stylesheet per
candidate namespace against Tailwind 4.3.3 and checked whether the utility was
actually emitted — `--font-size-probe` produced nothing while `--text-probe` did.
Five v3-config names are confirmed inert with a v4 equivalent:

| Inert (v3 name) | v4 namespace |
|---|---|
| `--font-size-*` | `--text-*` |
| `--line-height-*` | `--leading-*` |
| `--letter-spacing-*` | `--tracking-*` |
| `--box-shadow-*` | `--shadow-*` |
| `--border-radius-*` | `--radius-*` |

That is deliberately narrower than "every namespace Tailwind doesn't consume", and
the narrowing is the point: my first probe also reported `--font-weight-*` and
`--container-*` as inert, but those are **valid** in v4 — I had simply paired them
with the wrong utility name. A broad list built from that probe would have blocked CI
on correct code. Only pairs whose intended utility is unambiguous are listed.

The guard fails with the fix inline:

```
✗ Inert @theme tokens (v3 namespace Tailwind v4 does not consume): 1 (baseline 0)
      apps/frontend/src/index.css:36  --font-size-2xs declares no utility — use --text-* instead
```

It also caught a bug in itself, which is the part worth recording: the first version
filtered the existing `.ts/.tsx` file list for `.css` and therefore inspected
**nothing** while cheerfully reporting `0`. Guard against a vacuous guard — the same
lesson as the Escape test and the skipped drawer audit earlier. It now walks CSS
separately, and was verified to fail (exit 1) when the bug is reintroduced.

### Locale typography is asserted, not eyeballed

Since a visual pass is not possible here, the rules behind the Urdu and
`--font-display` fixes are asserted in
`apps/frontend/src/__tests__/designTokens.contrast.test.ts`:

- `:lang(ur)` leading is ≥ 2.2 (the Nastaliq contract) — caught a reintroduced 1.8;
- `--font-display` in `:root` does **not** name Amiri, so en/fa do not fall back to a
  generic serif — caught a reintroduced Amiri;
- the Amiri stack *is* scoped to `[lang="ar"]` / `[lang="ur"]`;
- the type scale is declared in `--text-*` and none of the inert v3 names are present.

That is the most that can be claimed without seeing the screen: the rules apply
correctly. Whether 2.2 leading looks right in Nastaliq is still a judgement call.

---

## Update 2 — the ratchet is now fully closed

Two more things were verifiable in this environment, so they were done rather than
listed.

### Print is guarded, and the guard runs in CI

The ID-card fix had been "verified by reading the cascade", which is not verification.
It now has two guards, and both were confirmed to **fail** when the bug is
reintroduced:

- `e2e/tests/print-documents.spec.ts` uses `page.emulateMedia({ media: 'print' })` —
  the only way to ask a real browser "what is actually visible on paper?" — and
  asserts computed style rather than pixels. It is **not** tagged `@local-only`: CI
  `grepInvert`s that tag, and a guard CI skips is not a guard.
- `apps/frontend/src/__tests__/printStyles.test.ts` asserts the same invariant against
  `index.css`, which is cheap and survives e2e being filtered.

Reintroducing `.shadow-sm` into the print hide-list reproduces the original bug exactly
— computed `display` becomes `none` — and both guards catch it. That also confirms the
mechanism described in the review empirically rather than by inference.

**Two corrections the first version of that spec needed**, both worth recording:

1. *It raced the a11y spec.* It bootstrapped its own tenant, and
   `bootstrapAuthenticatedTenant` calls `resetPlatformUsers()` — a `execSync` that wipes
   platform users in the **shared** database. The config is `fullyParallel` with 2
   workers in CI, so a second tenant-bootstrapping spec races the first; run together,
   this one hung for its full 5-minute timeout. Fixed by removing the tenant entirely:
   the property under test is global CSS, so it now runs against the unauthenticated
   entry page and takes **1.2s** instead of 14s. 6 of 7 consecutive combined runs are
   clean (the one failure immediately followed a stylesheet rewrite, i.e. stale HMR;
   CI also retries once). The overlay-scrim half of the invariant moved into
   `a11y-shell.spec.ts`, which already has a tenant and an overlay open.
2. *It picked a real element as its probe.* Plenty of production content legitimately
   carries `print:hidden`, so the probe failed on an element that was *supposed* to be
   hidden. It now injects its own probe directly under `<body>` — no ancestor, no
   opt-out, so `display: none` can only come from the blanket rule being guarded — plus
   a `print:hidden` **control** probe that must be hidden, so a pass cannot be vacuous.

### The last baseline entry is gone

`aria-hidden-focus` carried a note saying it was intermittent (~1 in 6 runs) and
unattributed. Since the `ProgressBar` ARIA fix: **12 clean full-gate runs** (each
auditing the dashboard twice) plus a **16-audit focused reload loop** — ~40 clean
dashboard audits where the old rate was 1 in 6, so ~0.1% likely if nothing had
changed. `A11Y_BASELINE` is now **empty**: every serious/critical WCAG 2.1 A/AA
violation fails the build, and the gate passes with nothing tolerated.

Stated plainly, this is a statistical argument rather than a reproduction. It is
recorded as such in `docs/a11y-baseline.md`, together with the note that if the finding
recurs the answer is to fix it, not to re-add the entry. The failure path is also
better instrumented now — a firing run prints the offending node's `html:` and axe's
measured values — so a recurrence names the element instead of restarting the
investigation from scratch.


---

## Update 4 — the gate's blind spot, and two real defects it hid

The `ProgressBar` baseline entry closed on a note that has been sitting there the
whole time: honouring `aria-hidden` made the *violation* go away without making the
*data* available. Chasing that turned up something more useful than the original
finding.

### The gate audits an empty tenant

`bootstrapAuthenticatedTenant` creates a tenant with **no records**. So every
data-dependent surface — populated tables, detail drawers, charts, metric widgets,
wizard steps — is never rendered, and therefore never checked. The green gate covers
the shell, empty states, and dialogs that need no data. That is a real limit on what
"the gate passes" means, and it also explains why the drawer audit kept skipping.

It is not academic: the follow-up found two places where meaningful data was hidden
from assistive tech inside populated components, neither of which could ever have
surfaced:

- **`ClassCard`** (sessions) hid its capacity row with `aria-hidden` and compensated
  with `aria-label` on the wrapper — but that wrapper is a role-less `<div>`, and
  naming is not exposed for the generic role, so the compensation never landed and
  class capacity was silent. Fixed by announcing the visible text and dropping the
  ineffective label.
- **`Step4ClassAssignment`** (enrollments) hid its entire remaining-capacity block,
  including "X spots left" — the single most decision-relevant number when picking a
  class — and the block sits inside the option `<Button>`, so it was excluded from the
  option's accessible name. Fixed by un-hiding the block.

Both keep the bar itself `aria-hidden`, because the adjacent figures already carry the
value and a widget role would announce it twice.

Recorded as a known blind spot in `docs/a11y-baseline.md`, with what closing it
requires: seeding the tenant before the sweep. I could not do that here — the
existing `tenantOperations` UI helpers are fragile enough that
`registerStudentJaneDoe` failed mid-flow when I tried to reuse it, and a proper fix
means either an API seed endpoint or repairing those helpers.

### Gate widened to WCAG 2.2

The tag set was pinned to WCAG **2.1**, silently excluding every 2.2 criterion —
notably `target-size` (2.5.8, the 24×24 minimum). `wcag22aa` is now included and the
sweep passes, which independently confirms the 44px-by-construction touch-target
finding from the original review.

### A negative result worth keeping

While looking at the `ClassCard` bug I found **21** `aria-label`s on role-less
`div`/`span` elements and nearly mass-refactored them, on the reading that ARIA 1.2
prohibits naming for the generic role. I checked first, by injecting the exact pattern
and running axe against it: **axe reports no violation.** So they are a spec-level
fragility, not a confirmed defect, and a 21-site refactor would have been unilateral
churn on my own reading rather than evidence. Left alone, and noted here so the next
person does not repeat the investigation.

The lesson is the same one that keeps recurring in this work: verify that the problem
is real before fixing it, and verify that the fix is doing anything afterwards.
