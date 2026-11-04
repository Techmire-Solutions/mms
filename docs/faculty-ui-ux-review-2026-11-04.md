# Faculty UI/UX Review — 2026-11-04

Rendered-experience review of the **Faculty** module at `main` HEAD `a51ae8bd5` plus the working tree,
following the backend (round 3) and frontend reviews of the same day. This pass fixes the
statically-verifiable UI/UX **bugs** and records the browser-dependent improvements as a prioritized
programme; it does not claim a rendered pass.

| | |
|---|---|
| Scope | `apps/frontend/src/tenant/features/faculty/**` (200+ files), and the shared primitives it renders: `ModuleCommandMetricsGrid`, `StatCard`, `ContactPickerMenu`, `ResponsiveAccordionTabs`, `WorkBatchTable` |
| Design intelligence | `ui-ux-pro-max --design-system` consulted — Flat/clean-dashboard guidance and "hidden assignments / poor mobile / cluttered navigation" anti-patterns adopted; its teal palette + playful pairing **not** applied (MMS keeps its semantic HSL token contract, `mms-ui-ux-design` §2) |
| Prior rendered pass | `docs/ui-ux-review-2026-11-04/README.md` (faculty: UX-02/03/04/05/11/12) |
| Method | `read`/`grep` over every faculty surface, DOM-level unit tests per finding (red → green), BiDi scan, token scan, i18n parity |
| Limitation | **No browser/axe run this pass** — the prior rendered review needed a Docker DB + Playwright harness. Layout claims requiring measurement are listed as improvements, not fixed (per `mms-ui-ux-design` §Done). |

## 1. Baseline evidence

| Gate | Result |
|---|---|
| Faculty frontend suite | **73 files / 246 tests pass** (was 71/240 at the start of this pass) |
| Shared app primitives (`src/components/app`) | **91 files / 389 tests pass** |
| Contact-picker primitives (`src/components/contactLink`) | **7 files / 22 tests pass** |
| `typecheck` | **0 faculty errors** (repo-wide run still fails on another session's dashboard/messaging/tasks edits) |
| `lint` | **0 errors in touched files** (2 pre-existing foreign errors: `useModuleCsvImportActions.ts`, `StudentsSetupTier.discard.test.tsx`) |
| BiDi physical-class scan | **0 violations** (3,936 files) |
| Faculty raw-palette / hex scan | **0** |
| `check:i18n` | **9,577 keys complete**, 0 missing / 0 EN-fallback |

## 2. Verdict

The module's **structure** is A−: three-tier scaffold, shared command centre, logical CSS, coherent dark
mode, correct RTL mirroring, honest empty states, and drawers/forms built on shared primitives. The
remaining defects are **state truthfulness and accessibility**, not composition:

1. **The workload pill was decorative** — it claimed "Available" for every member because no
   class-count producer exists (prior UX-11).
2. **Two critical a11y defects** stayed open from the rendered pass: the leave modal's unlabeled status
   switch and the contact picker's invalid `listbox` children (prior UX-03).
3. **The drawer lied after its own save** — the profile drawer reads a `useState` snapshot, so a leave
   save left the hero badge/banner showing pre-save values.
4. **KPI readability and the mobile orphan card** were fixed in the shared primitives by the concurrent
   UI/UX pass during this review (verified, §4.1).

All four are now closed with pinning tests. The remaining weight is in two **systemic layout** items that
need a rendered measurement: the mobile tier switcher (prior UX-04/P1) and the wide-table affordance
(prior UX-05/P2) — documented in §5 with acceptance criteria.

## 3. Findings fixed in this change

### UX-F1 · P1 (a11y critical) — Leave modal switch had no accessible name

**Evidence.** `FacultyLeaveModal.tsx:143` rendered `<Switch checked={isOnLeave} onCheckedChange={…} />`
inside a row whose visible "Staff Status" copy was an unrelated `<p>`; axe `button-name` is critical for
the modal's only control (prior UX-03).

**Fix.** The visible label carries `id="leave-status-label"` and the switch `aria-labelledby` it, so the
accessible name matches the visible text (WCAG 2.5.3).

**Test.** `FacultyLeaveModal.test.tsx` — asserts the `aria-labelledby`/`id` association (red before the fix).

### UX-F2 · P1 (a11y critical) — Contact picker popup violated `listbox` semantics

**Evidence.** `components/contactLink/ContactPickerMenu.tsx:41-62` put the `EmptyState` and the loading
`<div>` **inside** the `role="listbox"` container; a listbox may only contain options/groups, so axe
reported critical `aria-required-children` on `#contactId-listbox` (prior UX-03). Faculty create/edit is
the reported trigger; the fix is in the shared popup and benefits every module.

**Fix.** The positioned wrapper now only carries `ref`/`style`/overlay chrome. The inner content is either
a `role="listbox"` containing **only** option buttons, or a `role="status" aria-live="polite"` block for
loading/empty. `${resolvedId}-listbox` exists in both states, so the combobox's `aria-controls` always
resolves. Pointer-down preventDefault (no blur before selection) and anchor positioning are unchanged.

**Test.** `ContactPickerMenu.test.tsx` — populated listbox contains no `role="status"`; empty and loading
states render `role="status"`, the stable id, and no `listbox`.

### UX-F3 · P2 — The picker said "No contacts found" without explaining exclusions

**Evidence.** The faculty form excludes contacts already linked to a faculty member
(`excludeIds={linkedFacultyContactIds}`, `FacultyFormContactSection.tsx`), so a workspace whose contacts are
all linked opens an empty picker with only "Add the person in Contacts first" — misleading (prior UX-11).

**Fix.** When exclusions exist the picker receives an exclusion-aware hint
(`faculty.form.contactExclusionHint`, added in en/ar/ur/fa); the generic hint remains otherwise.

**Test.** `FacultyFormContactSection.test.tsx` — exclusion present → exclusion hint; no exclusions →
generic hint.

### UX-F4 · P2 — The workload pill fabricated a state for every member

**Evidence.** `FacultyWorkloadPill.tsx` derived `classCount` from `assignedClasses`/`assignedClassesCount`,
which no list or backend producer populates (backend workload M4 is deferred), so every active member got
the info dot "Available"; the count branch and "Moderate" were unreachable (prior UX-11).

**Fix.** The pill renders **nothing** when there is no class data and the member is neither on leave nor
inactive. The truthful states remain: On Leave (from `leaveDetails`, written by the leave modal), Inactive
(tenure status), Heavy Load/count when real data arrives.

**Test.** `FacultyWorkloadPill.test.tsx` rewritten — no producer → empty render; on-leave/inactive/count
branches unchanged.

### UX-F5 / UX-F6 · Readability and the mobile orphan card — already closed in the working tree

During this review the shared primitives were updated by the concurrent UI/UX pass:
`ModuleCommandMetricsGrid` now uses `lg:grid-cols-3 xl:grid-cols-5` for five metrics (three readable
columns at 1024, five-across only at xl) and `xl:grid-cols-4 2xl:grid-cols-6` for six; `StatCard`'s compact
label is `line-clamp-2` with `title`; odd strips span the last card on the 2-up mobile grid. Verified here
through `ModuleCommandMetricsGrid.test.tsx` (5/6/odd cases) and the faculty suite — **no further change made
by this pass**, and no duplicate implementation was introduced.

### UX-F7 · P2 — The open drawer showed pre-save values after saving leave

**Evidence.** The profile drawer receives a `useState` snapshot (`useFacultyPageOverlayState.viewFaculty`),
so `FacultyDetail.handleSaveLeave` persisted the leave but the hero badge/banner kept the old values until
the drawer was reopened (frontend review F-m1).

**Fix.** `FacultyDetail` gains `onFacultyPatched`; after a successful (2xx-guarded) leave save it emits the
patch, and `useFacultyPageOverlayProps` merges it into the open snapshot through the new pure helper
`patchViewFaculty` (same-reference no-op for another record / closed drawer).

**Test.** `lib/facultyOverlayPatch.test.ts` — merges into the matching record, ignores other ids, no-op when
closed.

### UX-F8 · P3 — Empty-cell em dash failed text contrast, twice over

**Evidence.** `FacultyDepartmentsTable.tsx:27` and `FacultyDesignationsTable.tsx:27` each defined
`const Dash = () => <span className="text-muted-foreground/50">—</span>` — a 50 % muted-foreground dash is
≈2.6:1 on the light surface, below the 4.5:1 floor, and the component was duplicated.

**Fix.** New shared `components/app/EmptyCellDash.tsx` at full `text-muted-foreground`; both tables consume it.

### UX-F9 · P3 — Entrance animations ignored `prefers-reduced-motion`

**Evidence.** `animate-in fade-in` in `FacultyLeaveModal`, `FacultyIjazahSection`, and
`FacultyDetailIjazahSection` (prior `mms-ui-ux-design` §4 / WCAG 2.3.3 gap).

**Fix.** `motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150` in all three.

### UX-F10 · P3 — Hand-rolled designation chip instead of the badge primitive

**Evidence.** `FacultyCardHeader.tsx:55-62` rendered an inline `bg-primary/10 text-primary border-primary/20`
span instead of the shared `Badge` used by the drawer hero for the same datum.

**Fix.** `Badge size="sm" tone="primary"` with `max-w-full truncate` + `title`.

## 4. Prior rendered-review status

| Prior item | Status now | Evidence |
|---|---|---|
| UX-02 KPI labels ellipsized at 1024/375 | **Fixed** (concurrent pass, verified) | `ModuleCommandMetricsGrid` breakpoint map + `StatCard` `line-clamp-2`/`title`; grid tests |
| UX-03 Faculty leave switch unlabeled | **Fixed** (UX-F1) | `FacultyLeaveModal.test.tsx` |
| UX-03 Faculty picker `aria-required-children` | **Fixed** (UX-F2) | `ContactPickerMenu.test.tsx` |
| UX-03 Faculty form `color-contrast` on `.text-primary/70` | **Hypothesis — not reproduced** | The only `.text-primary/70` nodes are `aria-hidden` decorative icons in the drawer's sessions section (`FacultyDetailSessionsSection.tsx:150,157`); axe excludes `aria-hidden` from contrast checks. Needs a rendered re-check. |
| UX-04 Mobile tier headers below content | **Open — programme UX-I3** | Shared `ResponsiveAccordionTabs` still stacks; needs browser verification |
| UX-05 Faculty table 1,820 px / actions off-screen | **Partial** | Name column **is** sticky (`stickyColumnId="name"`); actions stickiness/scroll cue remains — UX-I2 |
| UX-11 Workload pill "Available" for everyone | **Fixed** (UX-F4) | `FacultyWorkloadPill.test.tsx` |
| UX-11 Picker opens empty despite contacts | **Fixed as copy** (UX-F3); the exclusion behaviour is intentional | `FacultyFormContactSection.test.tsx` |
| UX-12 Orphan 5th card at 375 | **Fixed** (concurrent pass, verified) | Odd-count span in `ModuleCommandMetricsGrid.test.tsx` |
| 2026-10-31 row-actions / numerals / 44 px floor | **HOLDS** | No physical classes, no sub-12 px text, `min-h-11` on icon triggers |

## 5. Improvement programme (not implemented — needs a rendered pass or a product decision)

### UX-I1 · Default Work column set is a wall of 14 columns

The default Work registry carries `name, employeeId, designation, department, employDesignationStatus,
designationStartDate, designationEndDate, status, employmentStartDate, employmentEndDate, specialization,
qualification, notes, performanceRating` (≈1,940 px of declared widths). Two columns express status
(`status` vs `employDesignationStatus`) and four express tenure dates.

**Recommendation.** Ship a 7-column default (name, employee ID, designation, department, status,
specialization, actions) and move the rest to the column picker. Merge the two status columns into one badge
with a detail tooltip; merge each start/end pair into one "range" column.
**Acceptance.** Status + Actions visible at 1024 without horizontal scroll; every field still reachable via
the picker; export columns unchanged.

### UX-I2 · Wide-table affordance

Name is sticky; the actions column is not, and there is no scroll shadow/"more columns" cue. Either make
actions sticky with an edge shadow, or default to card view below `xl`.
**Acceptance.** No column cut mid-pill at 1024/1440; explicit affordance whenever the table scrolls.

### UX-I3 · Mobile tier navigation

`ResponsiveAccordionTabs` renders every tier header below the active tier's body (faculty Departments header
at y≈7,959 of an 8,311 px page). Add a sticky segmented tier bar above the content, or move all headers above
the panels and collapse inactive bodies.
**Acceptance.** Every tier reachable within one viewport of the page top, at 375 and 768.

### UX-I4 · Drawer information architecture

One long scroll (hero → profile → employment → designations → assignments → sessions → Ijazah). Add a
section anchor rail and collapse genuinely empty sections.
**Acceptance.** Any section reachable in ≤2 interactions; no empty section block rendered.

### UX-I5 · Command-strip semantics

"Filtered" equals Total when no filter/search/trash view is active. Render it only when a filter is applied.
**Acceptance.** The strip always shows four distinct facts; no redundant card.

### UX-I6 · Row density

The name cell carries avatar + employee-ID badge + designation chip (+ workload dot before UX-F4) —
≈80 px rows. Compact to one meta line; target ≤64 px.
**Acceptance.** More rows above the fold at 1440 with actions intact (browser-measured).

### UX-I7 · Workload producer

Backend M4 (`docs/open-items.md`) must supply class counts before the workload pill/column returns.
**Acceptance.** Server sends per-member counts; the pill mirrors them; no client-side fabrication.

### UX-I8 · Faculty a11y smoke

The module has no Playwright/axe spec. Add one covering Work (table + cards), drawer, create/edit form,
leave modal, and the filters menu so UX-F1/F2 stay pinned in the browser.
**Acceptance.** axe serious/critical = 0 on those five surfaces, en + ar.

## 6. Verified-clean surfaces

- **Three-tier scaffold & hierarchy** — peer tabs with icons/descriptions, lazy Reports/Setup, permission
  filtering, command-centre strip, sticky Work toolbar.
- **Tokens & BiDi** — no raw palette/hex in faculty components (0), no physical directional classes (0 across
  3,936 files), logical spacing/alignment throughout, RTL mirroring intact.
- **Density floors** — no sub-12 px faculty text; icon triggers carry `min-h-11 min-w-11`; `Badge`/`LegendChip`
  are the shared chip primitives after UX-F10.
- **Empty/error states** — directory empty state (search/trash/read-only) clears filters or links to active;
  Reports has `ErrorState` + retry; drawer sections degrade to skeletons, not fake data (after the frontend
  review's assignments fix).
- **Dark mode & theming** — semantic HSL tokens only; status colors come from `StatusBadge`/
  `facultyStatusMetricAccent`, never color alone.
- **i18n** — 9,577 keys complete across en/ar/ur/fa; the three hardcoded English placeholders found earlier
  are gone; the new exclusion hint is translated in all four locales.

## 7. Adversarial audit

**Accessibility.** The two critical overlay defects are closed at the DOM level (accessible name +
valid listbox children). The picker keeps its keyboard model (the input owns arrows/Enter/Escape; options
prevent pointer-down blur). Decorative dashes are `aria-hidden`; the loading/empty region is polite, so a
slow search does not shout. Reduced-motion users no longer get entrance animations. **Still untested:** a
real axe run, screen-reader traversal, 200 % zoom, and forced colors — UX-I8.

**Failure modes.** A failed leave save still keeps the modal open with conflict/error copy (frontend review)
and now does **not** patch the drawer; a successful save patches it immediately. A picker search failure
renders the same neutral empty state (no fabricated contacts).

**Truthfulness.** The two "fabricated state" classes found across this review series (workload pill here,
assignments row in the frontend review) are now both honest — nothing in the faculty UI renders a state the
server did not send.

**Consistency.** After UX-F10, the same datum (designation) is rendered by the same primitive in the card and
the drawer hero; empty cells use one shared dash.

**Concurrency/RTL.** All new classes are direction-agnostic (grid + logical spacing); the listbox restructure
does not change focus order.

## 8. Change set

Source: `components/contactLink/ContactPickerMenu.tsx` ·
`components/app/EmptyCellDash.tsx` (new) · `FacultyLeaveModal.tsx` · `FacultyFormContactSection.tsx` ·
`FacultyWorkloadPill.tsx` · `FacultyDetail.tsx` · `FacultyPageOverlays.tsx` ·
`hooks/facultyPageOverlaysTypes.ts` · `hooks/useFacultyPageOverlayProps.ts` ·
`lib/facultyOverlayPatch.ts` (new) · `FacultyCardHeader.tsx` · `FacultyDepartmentsTable.tsx` ·
`FacultyDesignationsTable.tsx` · `FacultyIjazahSection.tsx` · `FacultyDetailIjazahSection.tsx` ·
`packages/shared/src/i18n/appTranslations{En,Ar,Ur,Fa}.ts`.

Tests added/updated: `FacultyLeaveModal.test.tsx`, `ContactPickerMenu.test.tsx`,
`FacultyFormContactSection.test.tsx` (new), `FacultyWorkloadPill.test.tsx`,
`lib/facultyOverlayPatch.test.ts` (new). Verified unchanged: `ModuleCommandMetricsGrid.test.tsx`,
`StatCard.test.tsx` (concurrent pass).

Gates: faculty suite **73 / 246** · `src/components/app` **91 / 389** · `src/components/contactLink`
**7 / 22** · typecheck (0 faculty errors) · lint (0 in touched files) · BiDi 0 · `check:i18n` 9,577 keys.

## 9. Limitations

- **No rendered capture.** Everything here is static + DOM-level; colours, measurements and axe results are
  not re-proven. UX-I2/I3/I6 explicitly require a browser pass before they can be called fixed.
- **Concurrent working tree.** Another session was editing `contacts/`, `dashboard/`, `messaging/`,
  `students/`, `tasks/`, the shared metrics/stat-card primitives, and i18n during this pass; the repo-wide
  `typecheck`/`lint`/`code-norms` failures present right now come from those files. This change set does not
  touch or revert them.
- Chromium/synthetic-tenant constraints from the prior rendered review still apply if that harness is reused.
- Multi-suite vitest runs raced with the concurrent session's `@mms/shared` rebuild and lost their Vite dep
  cache mid-run (`Cannot find module .../.vite/deps/*.js`, always with **every executed test passing**). After
  clearing `apps/frontend/node_modules/.vite`, each scope passes in isolation; the numbers above are the
  isolated runs.
