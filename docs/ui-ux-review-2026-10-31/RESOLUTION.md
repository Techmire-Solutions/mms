# UI/UX Review Resolution — 2026-10-31

**Scope:** implement the actionable P1–P3 findings from [README.md](./README.md) plus the
defects confirmed while resolving them, and re-measure each fix against the running app. No
database migrations, API-contract removals, or palette/token changes were made.

| Gate | Result |
|---|---|
| `pnpm typecheck` | ✅ 6/6 tasks |
| `pnpm lint` | ✅ 4/4 tasks |
| `pnpm check:i18n` | ✅ 9,412 keys, 0 missing/fallback in ar/ur/fa (2 widget keys added) |
| `node .agent/…/check-bidi-classes.mjs` | ✅ 0 violations, 3,794 files |
| `check:shared-ui` / `check:code-norms` | ✅ 0 duplicates · 0 orphaned imports · all ratchets held |
| Frontend Vitest (affected dirs) | ✅ 413 tests (86 app-dir files, 384 tests; 32 dashboard tests; 3 contact-action) |
| Frontend + shared Vitest (full) | ✅ frontend **1,038/1,038 files · 3,735 passed · 2 skipped**; shared **233/233 files · 1,745 passed**; backend **331/331 files · 2,291 passed** |
| `pnpm ci:local:full` | ✅ **passed** — gates, Prettier, frontend Vitest, shared coverage, backend Vitest, i18n, production build, bundle budget (14.66 MB JS / 4.18 MB gzip) |
| `check:docs` / `check:work-directory` / `check:frontend-structure` | ✅ all ratchets held |
| New/updated unit specs | ✅ `CompactSegmentedControl` (3), `ChartGrid` (2), `ResponsiveAccordionTabs` (4), `ContactEmailAction` (1), `DirectoryCardMetaGrid` (1), `EntityCard` mobile rhythm (1), `dashboardWidgets` subtitle guard (2), `Button` caps/RTL (1) |
| `a11y-shell` core group @ 375 px + 1440 px (incl. open-drawer / mobile-sidebar audits) | ✅ 2/2 (warm server; empty-tenant drawer skips are expected) |
| `a11y-populated` populated students directory + detail drawer | ✅ 1/1 (drawer audit now opens; it used to log "no dialog opened — skipped") |
| `a11y-platform-workspaces` — **all nine console routes** × 375/1440 + design-system dark | ✅ **10/10** (closes the blind spot that hid the platform Design System contrast defect) |
| `capture-ui-ux-review.mjs --verify` | ✅ **10/10** — quick filters, card metadata height, integration copy, drawer axe, sort targets, greeting, page height, insights, mobile card metadata 2-up, RTL caps tracking |
| Responsive authenticated | ✅ **19/19** serial, warm server (includes the new card-metadata density assertion) |
| `a11y-shell` core group (re-check) | ✅ **2/2** after the metadata density change |

## 1. What changed, finding by finding

| Finding | Resolution | Evidence |
|---|---|---|
| **UX-01** mobile integration panels collapse to a 58 px text column | `IntegrationPanelChrome` header is now `flex-col` below `sm` and `sm:flex-row` above, with the status badge on its own row (`self-start ps-12 sm:ps-0`) so it can never outbid the copy. | Measured at 375 px on Settings → Notifications: description column **173 px** (was 58 px), panel 255 px. Unit guard in `IntegrationPanelChrome.test.tsx`. |
| **UX-02** mobile sidebar initials at 1.49:1 (serious) | `MobileSidebar` fallback now uses the fitted pair `bg-sidebar-primary text-sidebar-primary-foreground` (works with runtime branding). The shell axe sweep opens the drawer at 375 px and audits it (`auditMobileSidebar`). | The 375 px shell test passes with the drawer open; the rule previously had no audit path. |
| **UX-03** 16 px sortable headers | `ModuleTableHeaderCell` keeps the 16 px label but adds a 44 px `::after` overlay across the cell, so the whole header is the sort target without growing the row. The resize handle keeps its `z-elevated` layer. | Measured: sort button box 16 px, `::after` height **44 px** (`Student`, `Gender`, …). New `assertSortTargetsMeetMinimum` runs on every responsive module route. |
| **UX-04** row actions invisible until hover / drawer audits skipped | Trigger is always visible (`opacity-100`; the hover-only `md:opacity-0` rules are gone) and keeps the 44 px target. `auditOverlay` opens the row-actions menu and clicks its first item when the first click only opens a menu, so drawer/modal audits execute on populated routes. | Trigger opacity **0 → 1** (20/20 rows on contacts/students); populated sessions drawer audit passes; empty-tenant shell sweeps still skip (expected, see §4). |
| **UX-05** `PKR 7,250` KPI above `Rs 0` summary | Dashboard server-metric resolvers and both overdue widgets now call `formatMoney(..., { useSymbol: true })`, so every dashboard money figure uses the workspace symbol. Precision rules are unchanged (0 dp summaries, ledger precision stays with accounting). | Live dashboard: KPI `₨ 7,250`, outstanding `₨ 23,250`, summary `₨ 0` — one notation on the screen. Arabic: `₨ ٧٬٢٥٠`. |
| **UX-06** Arabic/Persian dashboards mix numeral systems | `dashboardCollectionMetricResolvers` routes every count through `formatNumber` and every percentage through `formatPercent`; no more `String(count)` or template-literal `%`. | Live ar dashboard (server-hydrated language): `٢٠` students, `٠٪؜` attendance, `+١٠٠٪؜` trend, `₨ ٧٬٢٥٠` — all Arabic-Indic. |
| **UX-07** emails wrap mid-token in tables | The global in-cell wrap override now exempts nodes that explicitly opt in via `data-cell-truncate`; `ContactEmailAction`'s value node sets it and renders a full-width truncating block (the drawer/inline variant stays a flex child) with the full address in `title`. | New `ContactEmailAction.test.tsx` asserts the opt-out + title; the rule change is commented with its rationale in `index.css`. |
| **UX-08** long, empty desktop dashboard | Greeting column is `min-w-0 flex-1` and the date/action block is capped at `lg:max-w-[58%]`, so the heading stops wrapping to four lines. The Insights disclosure is now identical on desktop and mobile (collapsed by default) rather than auto-expanding all seven secondary widgets. | 1440 px: `<h1>` **72 px / 2 lines** (was 144 px / 4), document height **2,657 px** (was 3,650), `Show insights` `aria-expanded="false"`. |
| **UX-09** widget search uses the contacts placeholder | Added `dashboard.widgets.searchStudents` / `searchSessions` in all four locales and used them in `OutstandingFeesTable`, `OverdueObligationsWidgetList`, `SessionsTable`. | `check:i18n` green with 9,412 keys. |
| **UX-10** chart text still 11 px | `chartAxisTick` clamps every request to `CHART_TEXT_MIN_PX = 12` (SSOT used by 20+ charts), and the five inline `contentStyle={{ fontSize: 11 }}` tooltips now use the same constant. | New `ChartGrid.test.tsx` pins the clamp (9/10/11 → 12, 14 → 14, muted fill). |
| **UX-11** platform Design System subtitle at 4.41:1 | Removed every `/90` description opacity from the shared `Alert` tone map (warning/info/destructive/success) and the two remaining tenant `text-warning/90` sites. | Alert descriptions now render the token at full strength, which the token contract guarantees on its own `/10` tint. |
| **UX-12** Urdu mixes Latin script / garbled cropper label | `contacts.metrics.pendingSync` → `زیر التواء ہم آہنگی`, `syncConflicts` → `ہم آہنگی تنازعات`, `closeCropper` → `کراپر بند کریں`. | A new mixed-script ratchet in `appTranslations.test.ts` fails on any Latin letter glued to an Urdu letter. |
| **UX-13** heavy locale packs | Persian covers every English key, so `fetchLanguagePack("fa")` no longer downloads and merges the 0.64 MB Arabic chunk. A test pins full FA key coverage. | Fresh-device Persian boot requests **only** `appTranslationsFa.js`; Arabic-chunk requests **0**. |
| **UX-14** orphan 5th KPI card | Count-based grid: 5 metrics → `lg:grid-cols-5`; 6 → `xl:grid-cols-6`. | Students at 1440: **5 cards, 5 columns, 1 row**; guarded by `ModuleCommandMetricsGrid.test.tsx`. |
| **UX-15** misleading password placeholder | `auth.passwordPlaceholder` is “Enter your password” in all four locales; `auth.rememberMe` is sentence case. | Rendered login probe returns both strings. |
| **UX-16** unverifiable platform trust claims | “256-Bit TLS” / “PostgreSQL RLS” replaced with the controls the app actually owns: “Protected session” / “Role-based access” (4 locales). | Fresh `/platform/login`: old strings absent, both new strings present. |
| **UX-17** very long mobile pages | Command metrics are 2-up from 375 px, directory-card metadata tiles are **2 columns at every width** (was a single column below `sm`), and the card itself uses a tighter mobile rhythm (`p-3 space-y-3`, desktop `sm:p-4 sm:space-y-4`). Settings and the card feed both shrink. | Metadata grid per card **407 → 251 px** at 375 (`--verify` height budget ≤280 px); harness check "mobile card metadata 2-up" (20/20 cards, 2 columns, 0 overflow); responsive suite green. Settings 4,141 → **4,025 px**. The remaining card height is header + contact pills + footer, which is a content decision left in §4. |
| **UX-18** unbounded trend deltas | `formatTrendDelta` caps at **999%+**, guards non-finite values, and formats with locale numerals. | Platform dashboard renders `999%+` (was `42467%`); `StatCardTrend` tests cover 999 / 1200 / 42467 / ∞. |
| **KPI label repeated as subtitle** (“Total Contacts” / “Total contacts”) | `resolveWidgetSubText` suppresses a subtitle equal to the resolved title (case/whitespace-insensitive); consumers fall back to a count subtitle. | Dashboard probe: **0** duplicate label/subtitle pairs; contacts card now reads “Total Contacts · Across your directory”. Guarded in `dashboardWidgets.test.ts`. |
| **Caps labels tracked in RTL** | `size="caps"` keeps `tracking-wider` for Latin but adds `rtl:tracking-normal`, and an unlayered `:is([lang="ar"], [lang="ur"], [lang="fa"]) .uppercase` rule covers every other uppercase label (the reset must stay outside `@layer base`, which loses to the tracking utilities). | Arabic dashboard buttons compute `letter-spacing: normal`; English still `0.025em`. Guarded in `Button.test.tsx` and `--verify` ("RTL caps tracking neutralised" in a real Arabic session). |
| **Copy** `Compact 100px` exposed a pixel value | `reports.widgets.compact` is now "Compact" / "مضغوط" / "مختصر" / "فشرده". | Visible on the dashboard density toggle. |

### Additional defects confirmed and fixed during resolution

- **Tier tabs blanked the module body on desktop.** `ResponsiveAccordionTabs` collapsed the panel when the already-selected tab was clicked (an accordion affordance) on desktop too, and the collapsed `""` key persisted. Collapse is now mobile-only, and `useModuleTierPageNav` resolves a persisted `""` back to the first visible tier on desktop. Guarded by two new tests (desktop no-op, mobile still collapses).
- **Mobile quick-filter presets superimposed their labels.** At 375 px the six Students presets rendered 45–57 px buttons for 62–108 px labels with `overflow-x: visible`; the tray is now a real scroller with `shrink-0` items (chip layout still wraps). Asserted by `CompactSegmentedControl.test.tsx` and the new `assertQuickFilterLabelsFit` responsive check. Live re-measure: every button `clientWidth === scrollWidth` (122/122, 183/183, …), tray `overflow-x: auto`.
- **Five-metric command centres left an orphan card**; the shared grid now maps count 5 to `lg:grid-cols-5` (2-up on mobile). Guarded by `ModuleCommandMetricsGrid.test.tsx`.
- **Chart tooltips** were the last 11 px text (`Hasanat`, `Question Bank`); they use the 12 px constant now.

## 2. Regression checks against the 2026-10-30 fixes

Spot-checked live while verifying these changes: Arabic-Indic dates still render (`٣١ أكتوبر ٢٠٢٦`), the dashboard greeting/dates/RTL mirror correctly, mobile modules still open at `scrollY = 0`, the language server-hydration path still switches `lang/dir` on a fresh context, and the shell axe sweep still passes at 1440 and 375. No token or palette values were touched, so the 29-pair contrast contract is unaffected.

## 3. Notes for CI

- The a11y and responsive sweeps need a **warm** Vite server; a cold first `page.goto` can consume the 20 s navigation budget and masquerade as a failure (README §8). `loginTenant` now retries once after a reload when the SPA is still on its loading shell after 30 s, and the three dashboard layout tests allow 120 s. With that, `responsive-authenticated` is **19/19**.
- The platform axe gate now audits **all nine console routes** at 375 and 1440 plus the Design System gallery in dark. It must keep the project's `reducedMotion: "reduce"` context: with motion enabled, card fade-ins sample at partial opacity and produce 17–18 transient `color-contrast` false positives on `/platform/users`. The extended gate was run at 10/10 after verifying the reduced-motion behaviour.
- The open mobile drawer is now part of the shell sweep, so its contrast regressions fail CI instead of hiding until a manual review.
- `a11yOverlay` now records a real skip only when no overlay can be reached; drawer audits on populated routes exercise the row menu.

## 4. Deferred items and decisions

Everything below was explicitly reviewed and either decided against or deferred for a concrete
reason. None of these is an open regression from this review.

| Item | Decision | Rationale / next step |
|---|---|---|
| **Arabic/Urdu locale pack splitting** | Deferred | Measured on-wire cost is **148–152 KB gzip** (raw 0.67–0.69 MB per locale). Splitting needs namespace loading with either fallback flicker (missing keys temporarily English) or route-scoped packs; that is an i18n-architecture change, not a UI fix. Persian no longer downloads the Arabic chunk (UX-13). |
| **Design-system consolidation** (7 radii / 12 shadows / duplicate button variants / four 12 px tokens) | Deferred | Cosmetic consistency only; needs visual-regression baselines first so consolidation cannot silently change rendered screens. |
| **Tenant breadcrumbs** | Deferred | Tenant navigation is flat; `PageHeader.breadcrumb` exists but no approved hierarchy/IA exists. The platform console already has a real `Breadcrumb`. |
| **Locale font preload / Nastaliq LCP** | Deferred | Fonts are Google-hosted; a meaningful preload needs self-hosting and subsetting (new asset pipeline). Preconnect is already present. |
| **Empty pinned dashboard widgets** | Won't fix | Primary empty panels are actionable states (“Mark attendance…”) and secondary insights are collapsed by default. Hiding them would remove the call to action. |
| **Empty-state CTAs beyond the eight directories** | Deferred | Requires per-module content/product decisions; the eight core directories already have CTAs. |
| **`FormModal.saveOnTabChange` default** | No change | Complex forms explicitly opt out already; flipping the global default risks data loss on tab switches. |
| **Per-column truncation policy** | Resolved as policy | Tables now use the explicit `data-cell-truncate` opt-in (UX-07); no blanket per-column rules are needed. |
| **Drawer audits on empty tenants** | Deferred | `a11y-populated` audits drawers on populated routes; seeding shell tenants adds runtime and DB mutation without new coverage. |

## 5. Reproduction

```bash
# unit + type safety
pnpm typecheck && pnpm lint && pnpm check:i18n
pnpm --filter mms-frontend exec vitest run src/components/app src/components/contact-action \
  src/tenant/features/dashboard ../../packages/ui/src/input/CompactSegmentedControl.test.tsx

# axe (warm the dev server first)
pnpm --filter e2e-tests exec playwright test tests/a11y/a11y-shell.spec.ts --project=a11y --grep "shell & core work"
pnpm --filter e2e-tests exec playwright test tests/a11y/a11y-populated.spec.ts --project=a11y
# all nine platform routes + design-system dark (10 audits, ~1.2 min)
pnpm --filter e2e-tests exec playwright test tests/a11y/a11y-platform-workspaces.spec.ts --project=chromium --workers=1

# responsive (includes the new quick-filter / sort-target / card-density assertions)
pnpm --filter e2e-tests exec playwright test tests/responsive/responsive-authenticated.spec.ts --workers=1

# the review harness's post-fix verification mode (added in this change)
cd e2e && UIUX_REVIEW_RUN=2026-10-31 node scripts/capture-ui-ux-review.mjs --verify
```

`--verify` (new) provisions nothing; it signs in to the review tenant and measures the
ten invariants this resolution claims, printing a pass/fail line per check and exiting
non-zero on regression:

```
✓ quick-filter labels fit: all presets fit
✓ card metadata height budget: 251px
✓ integration panel copy width: 173px
✓ mobile drawer contrast/a11y: 0 serious/critical
✓ sort-header hit area ≥ 44px: 6 headers
✓ greeting ≤ 2 lines: 72px
✓ dashboard height: 2657px
✓ insights collapsed by default: false
✓ mobile card metadata 2-up: {"count":20,"columns":[2,2,2],"heights":[251,251,251],"overflow":0}
✓ RTL caps tracking neutralised: {"lang":"ar","dir":"rtl","letterSpacing":"normal"}
10/10 verification checks passed
```

Measured on the local stack (`:5173` + `:3000`, review tenant `uiuxreview3425068023`):
settings integration copy 58 px → **173 px**; sort-header hit area 16 px → **44 px**;
dashboard `<h1>` 144 px → **72 px**; dashboard height 3,650 px → **2,657 px**;
card metadata 407 px → **251 px**; Arabic dashboard counts `20` → **٢٠**;
dashboard money `PKR 7,250` + `Rs 0` → **₨ 7,250 + ₨ 0**.
