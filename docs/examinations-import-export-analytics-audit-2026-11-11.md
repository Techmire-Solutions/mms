# Examinations Import / Export / Templates / Analytics Audit — 2026-11-11

**Scope:** document-template rendering (report cards, certificates, invoices of outcomes), CSV/XLSX
import-export, and the analytics behind the module's reports and widgets.

**Headline at audit time:** three of the four briefed capabilities did not exist — no admit cards,
no transcripts, no bulk marks importer, no broadsheet exporter — and the certificate print path had
no RTL/paper metadata. The report card also fabricated attendance/remarks when data was missing.
This is the record of what was found and what is now implemented.

## Implemented

| Area | Change |
|---|---|
| Certificate print | `printHtmlDocument` now writes `lang`, `dir`, `@page` and the shared print font stack (Amiri/Readex/Noto Nastaliq/Vazirmatn); `CertificatePreview` passes the active locale/direction. The legacy "Typst JSON download" button was removed. |
| Report-card payload | `mapToTypstReportCard` no longer invents `100%` attendance, Arabic praise remarks, an Arabic student name, a `1447-1448` year or `100` max marks — unknown values print empty (marks `-`). |
| Grace parity | A single-paper card prints the engine's effective marks (grace included), so the row equals the printed total. |
| Template tokens | `rank`/`classSize` added to the editor catalogue and default layout; the dead, always-empty `attendance` token was removed from the catalogue. |
| Exam CSV import | Rows now require a resolvable `class` (an exam with no class can never be marked); totals bounded by `MAX_MARKS_OBTAINED`; the dead `gradingScale` column was removed. |
| Marks import | New `POST /api/examinations/exams/:id/results/import` → `examinations:marks-import` runner: roll number resolved against the exam roster, marks bounded by the exam total and `MAX_MARKS_OBTAINED`, blank cells rejected (never a zero mark), per-row errors, deterministic ids (replay-safe), published exams refused. |
| Broadsheet export | New `POST /api/examinations/exams/:id/results/export` → `examinations:results-export` runner: keyset-paged marks, roster roll/name columns, `buildCsvContent` (formula-injection safe), 50k cap. |
| Analytics | `GET /report-aggregates` now always returns `analytics`: subject pass/fail, grade distribution (generated from the shared `GRADE_BANDS`), top performers and section averages — one tenant-scoped read with the existing workspace indexes. |
| Analytics UI | New Reports-tier charts (`ExaminationsReportCharts`) render those aggregates with plain bars (no chart runtime on the tier). |
| Frontend state | Marks grid skips blank cells on save (no false zero), has an unsaved-changes guard and a confirm before switching exams, catches save failures (no unhandled rejection), Enter/ArrowUp/ArrowDown move between inputs, invalid cells show an inline message, and a summary explains why Save is blocked. |
| Cache correctness | `invalidateExaminationsQueries` now includes the report-aggregates key; publish/unpublish invalidates exams/results/metrics/analytics instead of refetching only eligibility. |
| Contract alignment | `ENUM` from `EXAM_STATUSES`; `minAttendancePct` exposed on the exam DTO; a dedicated `examMarksWriteSchema` (no moderation fields, marks required) replaces the full-record body for bulk marks saves; total-marks bound in the exam form; numeric fields are clearable. |

## Verified controls

- CSV formula injection remains neutralised (`escapeCsvCell`); the XLSX serializer was probed and
  writes leading `=`/`+`/`@` as strings (no `<f>` tags).
- Template persistence is server-side with CAS/409; print windows set `dir`/`lang`/`@page`.
- Analytics queries are covered by `exams(workspace, date/status/active)`,
  `exam_classes(workspace, class)` and `exam_results(workspace, exam, student)`.

## Deferred (documented, not silently dropped)

- **Result status model** (Present/Absent/Exempted/Disqualified/Withheld): needs a column,
  migration and propagation through scoring, transcripts and exports.
- **Assessment types** (exam/quiz/assignment): needs a column + form/filter wiring.
- **Grading-scale builder**: grading remains the shared `GRADE_BANDS`; the preferences
  `gradingSystem` string stays unused until a builder exists.
- **Admit cards / transcripts** as designed templates (no timetable/room model yet).
