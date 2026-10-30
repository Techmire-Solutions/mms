# UI/UX Review Resolution — 2026-10-30

**Scope:** implement every P0–P3 finding from [README.md](./README.md), or reclassify it when
re-measurement showed the original capture was an artifact. No database migrations or API contract
removals were made.

## Verification summary

| Gate | Result |
|---|---|
| `pnpm typecheck` (all packages) | ✅ 6/6 tasks |
| `pnpm lint` (all packages) | ✅ 4/4 tasks |
| `@mms/shared` Vitest | ✅ 233 files / 1,744 tests |
| `mms-frontend` Vitest | ✅ 1,047 files / 3,757 tests + 2 skipped |
| `pnpm run check:i18n` | ✅ 9,434 keys, 0 missing/fallback in ar/ur/fa |
| `check:code-norms`, `check:work-directory`, `check:shared-ui`, `check:frontend-structure`, `check:docs`, `check:shared-purity` | ✅ |
| Shell axe (`a11y-shell`) | ✅ 9/9 |
| Platform full-page axe (`a11y-platform-workspaces`) | ✅ **2/2** — workspaces and dashboard at 375 + 1440, with `#main-content` filter removed |
| Populated axe (`a11y-populated`) | ✅ existing 7 + new dashboard/student-modal tests |
| Responsive authenticated (`responsive-authenticated`) | ✅ 19/19 at 375/768/1440 |
| Responsive shell (`responsive-shell`) | ✅ 24/24 |
| Settings sticky (`settings-sticky.spec.ts`) | ✅ save bar + sub-nav stay below the header after scroll |
| Public admissions (`public-apply.spec.ts`) | ✅ anonymous `/apply` stays public with empty state + sign-in CTA |
| `pnpm ci:local` / `pnpm ci:local:full` | ✅ final runs passed; full includes i18n, build and bundle budget |

## Finding-by-finding

| Finding | Resolution | Evidence |
|---|---|---|
| **P0** Arabic/Persian dates are `NaN/NaN/NaN` | Parse Arabic-Indic/Extended Arabic-Indic digits before `Number()`; format day/month/year with the active locale's numbering system; force Gregorian for generic dates so `ar-SA` does not silently return Hijri years. The settings format samples use the same digit parser and locale formatter. | `settingsDateFormattersCore.ts`, `settingsDateDigits.ts`, `intlDigits.ts`, `dateFormatLocales.ts`; tests for en/ar/fa/ur incl. Gregorian `ar` and localized samples; live `/finance` had **0** `NaN`, dates `٣١/٠٣/٢٠٢٦`, and the settings sample showed `DD/MM/YYYY · ٣٠/١٠/٢٠٢٦`. |
| **P1** contacts `Name` collapses to 33 px | `name` width 220; `ResizableTableHead` treats `<=0` as auto; persisted zero widths normalized by the existing header path. | `contactColumnRegistryPrimary.ts`, `ResizableTableHead.tsx`; SSR test; live contacts `<th>` measured **220 px** with no header spill. |
| **P1** platform axe gate red | Full-page audit; sidebar search removed (duplicate); table/chip contrast fixed; mobile search labelled; chart wrappers made `inert`; sidebar avatar/footer labels fixed. | `a11y-platform-workspaces.spec.ts` passes at 375/1440 with `include` removed. |
| **P1** platform mobile header broken | Logo-only brand below `sm`; responsive `compact` header controls; search gets an accessible name; duplicate Create CTA removed. | 375 px: page overflow **0**, header controls 44 px, search name present; screenshot in review artifacts. |
| **P1** language resets on a fresh browser | Boot hydration from the existing authenticated `GET /api/db/objects/global_settings`, merging only `language/timezone/dateFormat`, fail-open, once per tenant. Translation provider waits for hydration. | `globalSettingsHydration.ts`, `useHydrateGlobalSettings.ts`; live fresh context + server `ar` rendered `lang=ar dir=rtl`. |
| **P1** dashboard overpacked/truncates money | Print/Customize moved into the welcome header; KPI truncation removed; mobile shows 4 metrics + Show all; charts/switch widgets collapse behind an Insights disclosure; default Outstanding list unpinned; invoice seed cohorts differ; chart empty states added. | `DashboardPage`, `WelcomeBanner`, `StatCardBody`, `DashboardWidgets`, `widgetSeedsFinancial`, `seed-20-invoices`, chart components; mobile live height **5,192 px** (was 7,636), no truncated KPI text, `Show all metrics (8)` / `Show insights (7)` present. |
| **P1** mobile modules open scrolled | Scrolling is enabled only after a user tab change, not for a persisted/deep-linked tab. | `ResponsiveAccordionTabs`; live `/contacts`, `/students`, `/finance` all `scrollY = 0`; responsive spec asserts it. |
| **P2** English display font is Amiri | Default English display stack now Plus Jakarta Sans/Inter/system-ui. | `languageUtils.ts` test; live computed `--font-display` is the sans stack. |
| **P2** row action targets 28 px / checkboxes 16 px | **Correction:** both already carry 44 px pseudo hit areas. The real row-action defect was overlapping 44 px hit areas at `gap-1.5`; gap increased to 16 px. Checkbox cell remains 48 px. Segmented controls gained `min-w-11` to close the one real Urdu target-size node. | `EntityMessagingActions` test asserts `gap-4`; Urdu dashboard axe has zero serious/critical; Checkbox primitive already has `after:h-11 after:w-11`. |
| **P2** two contrast regressions | Removed `/70–/80` text opacity modifiers; workspace subdomain chip uses a primary tint with foreground text; sidebar avatar fallback uses solid primary/primary-foreground. | 29 files normalized; platform full-page gate and shell axe pass. |
| **P2** search promises entities but shows pages | Copy now says “Search pages and modules…” in all four locales; palette list gets a viewport cap and bottom padding; columns popover scrolls. | i18n check; `CommandPalette`, `ModuleColumnCustomizer`. |
| **P2** mixed numeral systems / BiDi | Added `formatPercent`; StatCard and dashboard percentages use it; currency/number cells and compact pagination are isolated with `<bdi dir="ltr">`; finance/overdue dates use `DateText`. | `moneyFormatUtils` tests; `TableCell`, `ListPagination`, `StatCardBody`, `DateText`; live Arabic finance uses Arabic-Indic dates. |
| **P2** 10–11 px micro-text | `--text-3xs` and `--text-4xs` raised to 12 px; token test floor updated. | `index.css`, `designTokens.contrast.test.ts`; all responsive checks still pass. |
| **P2** Students hidden under Academics | Students promoted to top-level nav between Contacts and Faculty. | `moduleRegistry`, `useSidebarNav.test`. |
| **P2** empty charts look broken | Enrollment/attendance/revenue/hasanat show a localized empty state when there are no records instead of fabricated axes. | `ChartEmptyState`; populated dashboard test passes. |
| **P2** student form opens with destructive banner | Neutral hint until a submit produces `validationErrorSummary`. | `StudentForm` + `students.form.contactRequiredHint`; new student modal axe test passes. |
| **P2** settings save at the bottom of 2,554 px | The General panel renders its save/discard bar above the fields; both it and the sub-nav now use a real token-backed `top-header` utility. **Correction:** the `top-header` class existed but was never defined, and `#root`/shell `overflow-x-hidden` created a non-scrolling ancestor; both made sticky ineffective. Added the utility and switched root/shell horizontal clipping to `overflow-x: clip`. | `SettingsShell`, `ResponsiveAccordionTabsDesktop`, `index.css`, `AppShell`; `settings-sticky.spec.ts` proves save bar and sub-nav stay below the header after scroll. |
| **P2** admissions empty state is a dead end | Added explanation, sign-in CTA, and `nav.apply` in all packs; fixed the auth-probe redirect that sent anonymous `/apply` visitors to `/login`. | Live `/apply`: title **“Open admissions \| Al-noor Model Madrasa”**, empty description and sign-in link present. |
| **P2** platform top bar crowded/duplicated | Removed sidebar search and banner Create CTA; switcher cannot shrink to “J…”; Copilot/search labels match visible text; breadcrumb/status/Copilot labels reveal at `2xl`. | 1440 px header overflow **0**; full-page gate. |
| **P3** overlay clipping | Palette max-height + bottom padding; columns popover max-height/scroll. | `CommandPalette`, `ModuleColumnCustomizer`. |
| **P3** created-date cut at 812 | **Correction:** this was the normal page scroll position, not a clipped card. Rechecked; no code change. | Visual recheck. |
| **P3** login checkbox 16 px | **Correction:** 16 px visual inside a 48 px labelled cell plus a 44 px pseudo target. No change. | `Checkbox` primitive; login markup. |
| **P3** transient “Sync error” | Not reproduced across repeated fresh-tenant setup. No persistent defect found; existing error/retry path retained rather than changing sync semantics blind. | Repeat setup runs; no axe/functional failure. |

## New regression catches during the fix

- Anonymous `/apply` redirected to `/login` because the `GET /api/auth/me` 401 was classified as a
  tenant session-expiry. `AUTH_PATHS.me` is now excluded from session-expiry redirects; the public
  admissions page renders its empty state. Covered by `apiClientHelpers.test.ts`.
- Translation hydration initially used raw `apiFetch` inside `tenant/hooks` (boundary violation) and
  called `setState` synchronously in an effect. Fetch moved to `src/lib/globalSettingsHydration.ts`;
  the hook derives `isHydrating` and only sets state in the async completion callback.

## Residual notes

- Existing tenants retain explicitly saved dashboard pins; the new default applies to new
  tenants/fixtures only.
- The review fixture still contains historical local preferences; verification used fresh contexts
  and new seeded tenants where behaviour depends on defaults.
- The transient sync banner is the only finding not backed by a reproducible defect; it is recorded
  here rather than “fixed” speculatively.
