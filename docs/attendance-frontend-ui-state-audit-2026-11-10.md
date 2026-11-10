# Attendance Frontend UI & State-Management Audit

**Date:** 2026-11-10 · **Scope:** the marking grid (list/cards views), TanStack Query pipelines and
cache invalidation, and rapid-entry UX (hotkeys, keyboard navigation, unsaved changes, validation).

**Headline:** the grid was fast where it mattered least and unsafe where it mattered most. It had no
unsaved-changes guard, its optimistic-concurrency token never left the browser, "Submit" never locked
the day, `Shift+P` mass-marked the class, and the invalidation helper refreshed the list but **not the
roster it was editing** — widget freshness depended entirely on the websocket.

## Findings

### Roster matrix UI

| # | Sev | Finding | Evidence |
|---|---|---|---|
| F1 | **High** | No unsaved-changes guard: switching class/date, changing Work tab or closing the tab discarded every edited row silently. The shared `useUnsavedChangesGuard` existed and was used by Setup/calendar only. | `useMarkAttendanceController`, `useUnsavedChangesGuard.ts` |
| F2 | **High** | The OCC token never round-tripped: `attendanceRecordsFromRows` dropped `version`, `AttendanceRow` had no version, the drawer sent no `x-expected-version`. Two instructors overwrote each other silently and the server's `stale_write` guard was unreachable. | `markAttendanceRowUtils.ts:47-75`, `useAttendancePageActions.ts:51-60` |
| F3 | **Medium** | "Submit" was local only: no UI called `submitDay`/`reopenDay`, so the roster lock, `lockAfterSubmit`, the reopen flow and the day-submission audit were unreachable, and the *Submitted* badge was component state that vanished on reload. | `useMarkAttendancePersistence.ts`, no `submitDay` caller |
| F4 | **Medium** | Blocking I/O in the keystroke path: `setRow` wrote `localStorage` synchronously (parse + stringify of up to 50 entries) for every field change, including each character typed into notes. | `markAttendanceQueue.ts:33-42` |
| F5 | **Medium** | Re-render cost: table `columns`/`tableData` rebuilt each render, row components not memoized, `filteredRows`/`stats`/roster-key recomputed each render. Virtualization (>30 rows) bounded the DOM but not the work. | `MarkAttendanceTableView.tsx`, `MarkAttendanceGrid.tsx` |
| F6 | Info (good) | Responsive split was already right: cards below `md`, table at `md+`, both virtualized. | `useWorkDirectoryViewMode`, `MarkAttendanceCardsView` |

### TanStack Query pipelines

| # | Sev | Finding | Evidence |
|---|---|---|---|
| F7 | **High** | No key factory: scattered literals (`["attendance","roster",…]`, `["attendance","lifecycle",…]`, coverage, lookups, preferences) and an invalidator that refreshed `["attendance","list"]` + metrics + setup but **not the roster or lifecycle**. The invalidator's test pinned the incomplete list. | `attendanceQueryKeys.ts`, `invalidateAttendanceQueries.ts`, `useAttendance.ts:107` |
| F8 | **High** | Widget/KPI invalidation depended on the websocket: `invalidateAttendanceQueries` omitted the dynamic-widget aggregates and the dashboard summary; only the live-push dispatcher touched them. A dropped socket left stale class-overview numbers after marking. | `createModuleQueryInvalidator.ts`, `invalidateModuleQueries.ts:36-47` |
| F9 | **Medium** | A leave decision rewrites marks server-side (retroactive `absent → excused`) but the mutation invalidated only the lifecycle key; attendance relied on the WS push. | `useAttendanceLifecycle.ts:33,63-71` |
| F10 | **Medium** | No optimistic updates/rollbacks anywhere in attendance (no `onMutate`/`setQueryData`/`cancelQueries`); the drawer edit waited a round trip. | repo grep |
| F11 | **Low** | `useAttendanceRecordsState` synced the total via an effect keyed on an inline callback, re-running every parent render. | `useAttendanceRecordsState.ts:92-96` |

### UX & rapid entry

| # | Sev | Finding | Evidence |
|---|---|---|---|
| F12 | **High** | `Shift+P/A/L` mass-marked the class: the handler accepted `altKey **or** shiftKey`, so a shifted letter typed after clicking a cell marked everyone present with no confirmation or undo. | `useMarkAttendanceKeyboardShortcuts.ts:40-56` |
| F13 | **Medium** | No per-row keyboard path (no arrows, no digits/space), no hotkeys for `excused`/`half_day`, and `Cmd+Enter` submitted while typing notes (the input guard was after the submit shortcut). | same file |
| F14 | **Medium** | Each row contributed five status buttons to the tab order (hundreds of stops on a 200-student roster) and mass actions announced nothing. | `StatusToggle.tsx` |
| F15 | **Low** | No inline validation (`late`/`half_day` without time-in) and a rejected batch surfaced as one flattened toast; the envelope's per-row errors were never rendered. | `useMarkAttendancePersistence.ts` |

## What changed

**Query pipeline**
- `attendanceQueryKeys.ts` is now the factory: every key is rooted at `["attendance"]`, including the
  roster (class/date/section, whitespace-normalised), lifecycle, leaves, alerts, marked dates, lookups,
  preferences, report aggregates and day submission.
- `invalidateAttendanceQueries` invalidates the root **plus** `DYNAMIC_WIDGET_AGGREGATES_QUERY_KEY` and
  `DASHBOARD_SUMMARY_QUERY_KEY_ROOT`, so list, roster, metrics, reports, lifecycle, lookups, KPIs and
  report widgets all refresh from the acting client without the websocket.
- `updateRecord` gained an optimistic patch with snapshot/rollback (`cancelQueries`, `onMutate`,
  `onError`, `onSettled`); batch saves stay authoritative and adopt the persisted rows.

**Grid integrity**
- Rows carry `recordId`/`version`, the payload echoes the token, and the drawer sends
  `x-expected-version` — the `stale_write` guard is now reachable. A roster refetch merges into the
  grid: clean rows adopt server values, dirty rows keep local edits and drop their token, and a
  conflict banner reports how many rows changed elsewhere.
- `Submit` now persists and then calls `POST …/days/:classId/:date/submit`; the badge is read from a
  new `GET …/days/:classId/:date` (unlocked record when never submitted) and an admin can reopen with a
  mandatory reason.
- Dirty tracking is a baseline snapshot of persisted fields; `useUnsavedChangesGuard` prompts on tab
  close and the page controller prompts on class/date/section or Work-tab changes, with Save-draft /
  Discard actions.
- The audit log is buffered (`queueAuditEntry`) and flushed once per burst, on save and on unmount,
  instead of a synchronous `localStorage` write per keystroke.

**Rapid entry**
- Mass actions require **Alt** (`Alt+P/A/L/H/E`, half-day and excused included); `Shift+letter` is
  ignored; `Cmd+Enter` is ignored inside inputs.
- New `useRosterRowNavigation`: arrows/Home/End move a visible cursor, `1–5` set the focused student's
  status, `Space` marks present, `Enter` opens notes. Status groups use a roving `tabIndex` (one tab
  stop per row) with arrow keys inside the group, and the stats strip is an `aria-live` region.
- Client-side validation blocks `late`/`half_day` without a time-in and inverted time ranges, and both
  validation failures and server batch errors render per-row in a banner.

**Performance**
- Memoized table columns/data, `enabledFields`, row callbacks (`setRow`/`markAll`/`setStatus`), and the
  roster-key/records signatures; the merge effect returns the same array reference when nothing
  changed, so a parent that recreates `records` cannot loop.

## Verification

- `pnpm typecheck` 6/6; attendance suite **101 tests** (91 pre-existing + key-factory, row-navigation,
  OCC round-trip and audit-buffer tests) — all green.
- Backend: **3,138 tests / 458 files** (new GET day-submission route type-checks and passes the router).
- `bash scripts/ci/local-ci.sh` — **passed** (gates, prettier, frontend vitest, shared test, backend vitest).
- Ratchets: code norms (299-line controller after extraction), docs, i18n, migration hygiene — green.

## Accepted trade-offs / follow-ups

- The shared `WorkBatchTable` has no `getRowProps`, so the keyboard cursor is a visible highlight and
  scroll-into-view rather than DOM focus on the `<tr>`; making it a true roving focus would change a
  component used by every module (tracked as a follow-up).
- Batch saves remain non-optimistic (server-authoritative rows); only single-record writes are
  optimistic.
- `Shift`-based mass marking is deliberately removed — a breaking change for muscle memory, surfaced in
  the class-bar help text.
- The day-submission state is polled with a 15 s stale time rather than pushed; the lock policy is
  enforced server-side, so a stale badge cannot allow a write.
