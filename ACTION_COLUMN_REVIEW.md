# Action Column Review — All Tables, All Modules

> **Status: RESOLVED** — findings A1–A6 and B1–B6 below were fixed in a follow-up pass (see §5). The report is retained for traceability.

**Scope:** Every table that renders an actions column across the Tenant Console, Platform Console, dashboard widgets, and shared catalog. Reviewed against the shared `WorkBatchTable` / `DataTable` stack and the `@shared/ui` table primitives.

**Date:** 2026-11-19 · **Reviewer:** lead agent

---

## 1. How the action column works (architecture)

There are **three distinct mechanisms** that produce an "actions" column today:

| #   | Mechanism                                                                                                                | Used by                                                                                                                               | Alignment                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1   | `WorkBatchTable` / `DataTable` `renderRowActions` + `actionsLabel` (+ `actionsHeaderClassName` / `actionsCellClassName`) | All module Work directories and setup/catalog lists                                                                                   | `text-end` (right)                           |
| 2   | `variant="action"` on `ModuleTableHeaderCell` / `TableCell`                                                              | Hand-rolled tables: `OutstandingFeesTableDesktopBody`, `OverdueObligationsWidgetList`, `PermissionMatrix*`, `JournalEntryLinesEditor` | `text-center` (see `getTableCellAlignClass`) |
| 3   | Inline `<Button>` rows inside a raw `TableHead`/`TableCell`                                                              | `MessagingListDesktopTable`, `ObligationCollectionsListDesktopTable` (print + row menu)                                               | right (`justify-end`)                        |

The canonical chrome lives in:

- `apps/frontend/src/components/common/work/WorkBatchTable.tsx` — renders header + cells.
- `apps/frontend/src/components/app/ModuleWorkTableHeader.tsx` — renders the actions `<th>`.
- `apps/frontend/src/components/common/work/WorkBatchTableRow.tsx` — renders the actions `<td>`.
- `apps/frontend/src/components/common/work/workBatchTableWidths.ts` — min-width math.
- Row-action primitives: `ModuleRowActionsMenu` (dropdown) and `DataTableRowActions` (inline icon buttons).

---

## 2. Findings

### A. Shared-chrome defects (affect every module that uses defaults)

**A1 — Action cell default width is wrong (48px vs 112px).** _(correctness / dead code)_

- Header default: `ModuleWorkTableHeader.tsx:72` → `actionsClassName = "w-28 min-w-28 text-end"` (112px).
- Cell default: `WorkBatchTableRow.tsx:119` → `actionsCellClassName ?? "w-12 min-w-12 px-2 py-3"` (48px).
- Min-width math: `workBatchTableWidths.ts:14` → `WORK_TABLE_ACTIONS_WIDTH = 112`.

The cell default `w-12` (48px) is the **selection-column** width, copy-pasted onto the actions cell. Under `table-fixed` the header width wins so it is dead code today, but it misleads reviewers and will break the moment a `<colgroup>` or a non-fixed layout is introduced. The cell default should match the header (`w-28 min-w-28`) or, better, both should read one shared token.

**A2 — Header/cell padding mismatch.** _(visual consistency)_

Header applies `px-4 py-3` (`ModuleWorkTableHeader.tsx:146`); the cell applies `px-2 py-3` (`WorkBatchTableRow.tsx:119`). The "Actions" header text and the row buttons are both right-aligned but sit ~8px apart, so the column looks off-axis.

**A3 — "Actions" header typography differs from data columns.** _(visual consistency)_

Data headers render through `ModuleTableHeaderCell` → `MODULE_TABLE_HEAD_CLASS` = `text-xs font-semibold text-muted-foreground uppercase tracking-wide` (`ModuleTableHeaderCell.tsx:8`). The actions header is a raw `TableHead` (`ModuleWorkTableHeader.tsx:146`) and only gets `font-medium text-muted-foreground` at `text-sm` — no `text-xs`, no `uppercase`, no `tracking-wide`. The "Actions" label renders larger/softer than its siblings.

**A4 — `computeWorkTableMinWidth` ignores `actionsHeaderClassName` overrides.** _(correctness, minor)_

`computeWorkTableMinWidth` (`workBatchTableWidths.ts:40`) hardcodes `WORK_TABLE_ACTIONS_WIDTH = 112` regardless of the real column width. Platform tables override to `w-56` (224px) and Obligations to `w-24` (96px), so the computed minimum is under-/over-reserved and horizontal squeeze/scroll can be slightly off.

**A5 — `DataTable` does not forward the action width/padding overrides.** _(feature gap)_

`DataTableProps`'s pass-through (`dataTableTypes.ts:70-79`) forwards only `actionsLabel`, not `actionsHeaderClassName` / `actionsCellClassName`. Every `DataTable`-based table (fiscal years, wakala distributions, designations, departments, admissions, registration links, session completion, catalog, messaging templates) is locked to the default header width and cannot tune the column like `WorkBatchTable` consumers can.

**A6 — "action" means center in one place, right in another.** _(semantic divergence)_

`getTableCellAlignClass(..., "action")` → `text-center` (`packages/ui/src/table/tableUtils.ts:15`), and `ModuleTableHeaderCell` treats `variant === "action"` as centered. But the canonical WorkBatchTable action column is `text-end`. The same word encodes two opposite alignments depending on which table stack is used.

### B. Consumer inconsistencies

**B1 — Mixed i18n keys for the column label.** _(consistency)_

The label is always `t()`-wrapped (no hardcoded English — good), and every key exists in all four locales (verified in `packages/shared/src/i18n/appTranslations{En,Ar,Ur,Fa}.ts`), but the key choice is inconsistent:

- `common.actions` — invoices, payments, messaging log, obligations collections, sessions, both platform tables.
- Module-specific `*.table.actions` / `*.columns.actions` / `users.colActions` / `obligations.wakala.colActions` — contacts, students, faculty, hasanat, question-bank, examinations, accounting, wakala.

There is no single canonical key, which makes auditing and future refactors error-prone.

**B2 — Width override applied to only one side.** _(consistency)_

- `MessagingListDesktopTable.tsx:149` sets only `actionsCellClassName="w-24 min-w-24 px-2 py-3"`; the header stays at the default `w-28` → 112px header over a 96px cell.
- `ObligationCollectionsListDesktopTable.tsx:95-96` and the platform tables set **both** sides consistently.

**B3 — Three row-action render patterns with no stated rule.** _(consistency / DRY)_

- `ModuleRowActionsMenu`-based `*RowActions` dropdowns (Work directories) — the documented SSOT per its doc comment.
- `DataTableRowActions` inline icon buttons (setup/catalog lists, tasks, workshops, admissions, registration links, session completion).
- Hand-rolled inline `<Button>` rows: `MessagingListDesktopTable.tsx:111-148` and `ObligationCollectionsListDesktopTable.tsx:97-124` (print + row menu) bypass the shared 44px primitives (`min-h-11 min-w-11` is still set, but the markup is duplicated).

The dropdown-vs-inline split is defensible (rich action sets vs 1–3 simple actions), but there is no documented decision rule, and Messaging/Obligations re-implement buttons instead of reusing `DataTableRowActions`.

**B4 — Redundant `className="table-fixed"`.** _(minor)_

`JournalEntriesListDesktopTable.tsx:98` and `ExaminationsListDesktopTable.tsx:153` pass `className="table-fixed"`; `WorkBatchTable` already applies `table-fixed w-full` at its root (`WorkBatchTable.tsx:138`).

**B5 — Redundant `title` + `aria-label`.** _(a11y, minor)_

`DataTableRowActions.tsx:34-35` sets both `aria-label` and `title` on each icon button. `title` adds a hover tooltip that duplicates the accessible name and can double-announce in some screen readers; the shared dropdown trigger (`ModuleRowActionsMenu`) uses `aria-label` only.

**B6 — Whole-column hiding gated on `canDelete` only.** _(behavior — confirm intent)_

`PaymentsListDesktopTable.tsx:167-168`, `SessionsListDesktopTable.tsx:219-233`, and `JournalEntriesListDesktopTable.tsx:116-117` set `renderRowActions`/`actionsLabel` to `undefined` unless `canDelete`. That is correct for delete-only rows, but it is a different gating convention than view/edit-capable tables (contacts/students/faculty), which always render the column. Worth a documented rule: _render the column whenever at least one row can have an action_.

---

## 3. Verified positives (no action needed)

- 44×44px touch targets (`min-h-11 min-w-11`) are consistent across both primitives.
- Icon-only triggers carry `aria-label`; the dropdown trigger is keyboard/screen-reader accessible.
- The action `<td>` calls `stopPropagation` (`WorkBatchTableRow.tsx:120`) so it does not fire `onRowClick`.
- Header cells emit `scope="col"` / `role="columnheader"`; tables emit `caption` and `aria-busy`.
- Read-only report tables (`GeneralLedgerEntries`, `TrialBalance`, `CashbookViewTable`, `FinancialLedgerTable`, etc.) correctly omit the action column entirely.

---

## 4. Recommended fixes (in priority order)

1. **A1/A2** — Single shared token for the action column: default cell to `w-28 min-w-28 px-4 py-3` (match header), or better, extract `WORK_TABLE_ACTIONS_CLASS` so header, cell, and `computeWorkTableMinWidth` read one source.
2. **A3** — Apply `MODULE_TABLE_HEAD_CLASS` to the actions header (via `ModuleTableHeaderCell` with `variant` or by reusing the class string) so "Actions" matches sibling headers.
3. **A5** — Add `actionsHeaderClassName` / `actionsCellClassName` to `DataTableProps`'s pass-through so `DataTable` consumers can tune the column.
4. **A4** — Accept the resolved action width in `computeWorkTableMinWidth` instead of hardcoding 112px.
5. **B1** — Standardize on one label key (`common.actions`) unless a module genuinely needs a distinct header; remove the redundant module-specific "Actions" keys.
6. **B2/B4** — Normalize `MessagingListDesktopTable` to set both header and cell; drop redundant `className="table-fixed"`.
7. **B3** — Document the dropdown-vs-inline rule in `mms-module-work`, and migrate Messaging/Obligations inline buttons onto `DataTableRowActions` where they are simple icon actions.

---

## 5. Resolution (applied)

| Finding | Fix                                                                                                                                                                                                                                                                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1/A2   | `WORK_TABLE_ACTIONS_WIDTH_CLASS` SSOT in `workBatchTableWidths.ts`; header + cell now share the default `w-28 min-w-28` and `px-4 py-3 text-end` chrome.                                                                                                                                              |
| A3      | Extracted `MODULE_TABLE_HEAD_TYPOGRAPHY_CLASS`; the actions header now matches data-column typography.                                                                                                                                                                                                |
| A4      | `computeWorkTableMinWidth` accepts an optional `actionsWidth`; platform tables pass `WORK_TABLE_ACTIONS_WIDTH_WIDE`.                                                                                                                                                                                  |
| A5      | `DataTable` now forwards `actionsHeaderClassName` / `actionsCellClassName`.                                                                                                                                                                                                                           |
| A6      | Doc comments clarified; `variant="action"` (centered) is now scoped to hand-rolled control/widget cells — `PermissionMatrix*`, `JournalEntryLinesEditor`, and the two dashboard widgets — while the standard row-actions column stays end-aligned. Accepted & documented (no visual change to those). |
| B1      | All action-column labels consolidated to the `common.actions` default; 9 now-dead keys removed from all 4 locale packs (Urdu "ایکشنز" drift fixed).                                                                                                                                                   |
| B2      | Width overrides normalized to width-only (padding/alignment from shared chrome); Messaging now sets both header + cell; Obligations uses the default.                                                                                                                                                 |
| B3      | Documented decision rule (below).                                                                                                                                                                                                                                                                     |
| B4      | Redundant `className="table-fixed"` removed.                                                                                                                                                                                                                                                          |
| B5      | Redundant `title` removed from `DataTableRowActions`.                                                                                                                                                                                                                                                 |

**Row-action pattern rule (B3):** Work directories use `ModuleRowActionsMenu`-based `*RowActions` dropdowns; setup/catalog lists use `DataTableRowActions` inline icons; labeled inline buttons (Messaging "Resend", Obligations "Print") remain legitimate compositions.

### Follow-up 1 — unique per-row trigger aria-labels

Every `*RowActions` trigger now uses `common.actionsFor` = "Actions for {name}" with the row's display identity (e.g. `getDisplayName(contact)`, `entry.ref`, `receipt_no`, `student.name`), replacing the shared bare "Actions" label that made every row's `⋯` announce identically. Removed 13 now-dead module trigger keys (`*.table.actions`, `students.list.actionsAria`, `sessions.classes.actionsFor`) from all 4 packs; updated 8 tests.

### Follow-up 2 — migrate remaining hand-rolled "Actions" columns

`AccountingPostingPeriodsSection` and `AccountingHedgesSection` moved their action buttons out of a data column (`id: "action(s)"`) and onto the standard `renderRowActions` + width overrides (`w-36` / `w-64`). The column now hides for read-only users. Removed `accounting.settings.hedges.actions` plus two pre-existing dead keys (`faculty.list.actionsAria`, `faculty.assignments.rowActions`).

### Follow-up 3 — platform fleet row menu

`PlatformDashboardFleetRowMenu` (Platform console) now announces `common.actionsFor` with `row.madrasaName`, completing the per-row trigger-label consistency across both consoles.

---

## 6. Completion review (4-vector adversarial audit)

**Verification gates — all green**

| Gate                               | Result                                            |
| ---------------------------------- | ------------------------------------------------- |
| `pnpm typecheck` (all 6 tasks)     | ✅                                                |
| `pnpm --filter mms-frontend build` | ✅ (exit 0; pre-existing chunk-size warning only) |
| Full frontend Vitest suite         | ✅ 1323 files · 4910 passed · 2 skipped           |
| `check:shared-ui`                  | ✅ 0 violations                                   |
| `check:forms`                      | ✅ ratchet clean                                  |
| `check:work-directory`             | ✅ 0 violations (4233 files)                      |
| `check:i18n`                       | ✅ 10,137 keys · 0 missing/EN-fallback            |
| `check-unused-keys`                | ✅ 279 unreferenced (238 under baseline)          |

**Edge cases** — every trigger call site guards a missing display name (`name ?? id`, `entry.ref`, `receipt_no`, `getDisplayName`, `studentName || id`); read-only users no longer get an empty action column (`renderRowActions={undefined}`); Urdu/Fa `common.actionsFor` keys place the object before "for" for correct RTL word order; long free-text identifiers (`question.text`, `entry.ref`) are acceptable in `aria-label` (no truncation needed).

**Failure modes** — `@mms/shared` `dist`/`AppTranslationKey` staleness resolved by rebuilding after key edits; 8 test mocks updated to `common.actionsFor`; `useMemo` dep array fixed after column removal (`react-hooks/exhaustive-deps`); full suite + build confirm no non-targeted regressions.

**Security / multi-tenancy** — no backend, RBAC, or DTO changes; action visibility is unchanged and still gated by the existing `canWrite` / `canDelete` / `canEdit` / `canManage` permissions; `aria-label`s expose only row data already rendered in the row (names, refs, receipt numbers) — no cross-tenant leakage. Frontend visibility remains non-authoritative, as before.

**Concurrency** — no shared mutable state, timers, or async identity changes; new width constants (`WORK_TABLE_ACTIONS_WIDTH_CLASS`, `WORK_TABLE_ACTIONS_WIDTH_WIDE`) are static module-level values; `renderRowActions` closures capture only immutable row + permission values.

**Verdict:** complete and safe to commit. The action column is now single-source-of-truth across Tenant and Platform: one chrome (`WorkBatchTable`/`DataTable` + `renderRowActions`/`actionsLabel`), one header label (`common.actions`), one trigger label (`common.actionsFor` with row identity), and documented exceptions for centered control cells (`PermissionMatrix*`, `JournalEntryLinesEditor`, dashboard widgets).
