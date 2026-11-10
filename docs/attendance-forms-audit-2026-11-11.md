# Attendance Forms Review

**Date:** 2026-11-11 · **Scope:** every form in the Attendance module — excuse request, leave/alert
decisions, calendar event create/edit, calendar copy, CSV import, setup preferences, register export,
inline record edit.

**Headline:** the forms looked complete but three of them could not fail safely: no attendance form
validated its draft against the shared schema, a rejected leave decision showed **nothing**, and an
emptied numeric preference persisted `0`. The CSV Import action promised a flow the backend always
answers with 503.

## Findings and fixes

| # | Severity | Finding | Fix |
|---|---|---|---|
| F1 | High | No attendance form validated before mutating; server 400s never mapped to fields. | New `lib/attendanceFormValidation.ts` wraps `safeParse` + the shared `mapZodFormErrors` + server-error extraction; every form validates on submit and shows field/banner errors without losing the draft. |
| F2 | High | Excuse submit and leave review/cancel/alert resolve had `onSuccess` only; the global MutationCache only reacts to 403, so failures were silent. | `onError` notifications on every lifecycle mutation + form error mapping. |
| F3 | High | `lowAttendanceThreshold` persisted `0`: `min`/`max` are hints and `Number("")` is 0; the normaliser passed the number through. | `useClampedNumberField` (empty restores the previous value, blur clamps) on the threshold and the two minute fields; `normalizeAttendanceModulePreferences` now clamps the percentage to 1–100 (shared test added). |
| F4 | High | CSV Import could never succeed — no `attendance_records:import` runner, route always 503. | `ATTENDANCE_IMPORT_AVAILABLE = false` gates both the header button and the dialog mount. |
| F5 | Medium | Excuse form used a free-text student id, native `<select>`, and `<input type="date">`. | Rebuilt as a `FormModal`: remote-search `SearchableSelectField` student picker, `FormSelect` type, `DatePicker` range with cross-constraints, notes, and a certificate control. |
| F6 | Medium | UTC "today": the excuse defaults and the export month used `toISOString()`, so a UTC+5 school saw yesterday before 05:00 and could export the wrong month at a boundary. | Both use `todayISO()` / a `monthBounds` helper; export validates the range and explains a missing class inline. |
| F7 | Medium | Approve/reject/cancel/resolve were one click, with no note/reason despite the API accepting both. | `ConfirmAlertDialog` for each decision: optional decision note for review, **required** cancel reason, optional resolve note; errors stay visible. |
| F8 | Medium | Excuse form had no unsaved guard and orphaned uploads. | `FormModal` dirty/discard handling; certificate can be removed (deletes the uploaded file). |
| F9 | Medium | Six save footers for one preferences draft. | Section footers removed; one sticky page-level footer. |
| F10 | Medium | Leave decisions invalidated only the lifecycle key, leaving roster/metrics stale without the websocket. | Decisions now also call `invalidateAttendanceQueries` (attendance root + widget/dashboard roots). |
| F11 | Low | Calendar form had one inline error; missing title/scope silently disabled Save. | Draft validated with `academicCalendarEventWriteSchema`; title/date/scope errors shown; failed save keeps the modal open with a message. |
| F12 | Low | Excuse buttons below the 44 px floor; required fields lacked `aria-invalid`. | `min-h-11` buttons, `aria-invalid`, `enterKeyHint`, labelled fields via `Field`. |
| F13 | Low | Inline record edit sent an inverted time range / late mark without time to the server. | `useAttendanceRecordsState` validates date/status and the status↔time rules before updating; the record stays in edit mode with a specific message. |

## Files

- New: `lib/attendanceFormValidation.ts`, `lib/attendanceCapabilities.ts`,
  `hooks/useClampedNumberField.ts`, `components/AttendanceExcuseStudentField.tsx`,
  `components/AttendanceExcuseAttachmentField.tsx`.
- Reworked: `AttendanceExcuseForm.tsx` (282 lines, modal), `AttendanceLifecyclePanel.tsx`,
  `AttendanceRegisterExport.tsx`, `AttendancePageHeaderActions.tsx`,
  `calendar/CalendarEventFormModal.tsx`, `calendar/CalendarEventScopeFields.tsx`,
  the five `Attendance*RulesSection.tsx`, `AttendanceSettings.tsx`,
  `hooks/useAttendanceLifecycle.ts`, `hooks/useAttendanceRecordsState.ts`,
  `packages/shared/src/attendance/attendanceSetupPreferences.ts`.
- i18n: new `attendance.excuses.*`, `attendance.alerts.*`, `attendance.calendar.scopeIncomplete`,
  `attendance.mark.validation*` and `attendance.toast.invalid*` keys in en/ar/ur/fa.

## Verification

- Attendance frontend suite: **62 files / 112 tests** pass, including new coverage for the shared-schema
  helper, the clamped numeric field, the excuse modal structure, the export month, decision
  confirmations, the single settings footer and the import gating.
- `pnpm --filter @mms/shared exec vitest run attendancePreferencesNormalization` — 3 tests pass.
- `pnpm run check:i18n` — all locales complete.
- Typecheck: attendance files clean. (The shared worktree also contains another agent's in-flight
  enrollments/sessions changes; their typecheck errors are unrelated to this review.)
- Every new file stayed under the 300-line ceiling; pre-commit lint, Prettier and code-norm gates pass.

## Follow-ups

- Calendar event form test was written but lost to a concurrent worktree reset before it could be
  committed; re-add `CalendarEventFormModal.test.tsx` (schema rejection keeps the modal open).
- Inline record edit still reports through a toast rather than a cell-level error; a per-cell error slot
  needs the shared table to expose row error props.
- Export offers CSV/XLSX buttons rather than a range-picking modal; the range is the selected
  day/month (validated) — extend to a modal if ad-hoc ranges are requested.
- CSV import can be re-enabled by flipping `ATTENDANCE_IMPORT_AVAILABLE` once a runner exists.
