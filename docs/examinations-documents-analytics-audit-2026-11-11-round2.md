# Examinations Documents, Import/Export & Analytics — Round 2 (2026-11-11)

**Scope.** Document-template rendering (report cards, certificates, the Typst PDF engine), mark
import/broadsheet export, and the report/widget analytics. Round 1
([examinations-import-export-analytics-audit-2026-11-11.md](./examinations-import-export-analytics-audit-2026-11-11.md))
built the marks importer, broadsheet exporter, analytics, and fixed the HTML certificate print. This
round re-audited the surfaces for rendering bugs, BiDi/RTL faults, missing-token fallbacks, OOM
vectors and slow reporting queries.

## Findings and fixes

| # | Sev | Finding | Fix |
|---|---|---|---|
| F1 | **P1** | The Typst engine silently replaced a failed render with a synthetic "conforming" PDF whose only content was `Data Summary: {JSON.stringify(data).slice(0,80)}` — a junk artifact that leaked a slice of student data and was reported as success. `typst` is not installed and no deploy script installs it, so every server-side PDF through this path was that placeholder; `typstEngine.test.ts` asserted the placeholder as a real render. | Deleted `generateConformingPdf`; `compileTypstToFile` now throws `TemplateRenderError` when the CLI is missing or compilation fails, so the job fails/retries/DLQs with no artifact. Tests mock the CLI and assert the missing-binary failure. |
| F2 | **P2** | The payload was passed as `--input data=<JSON>` in the process argv — student names/marks visible in `ps` to any host user, and a large payload could exceed ARG_MAX. | The compiler writes `data.json` inside a private temp root, copies the template there, and compiles with `--root`; templates read `json("/data.json")`. No payload in argv. |
| F3 | **P2** | `.typ` templates hardcoded `lang: "ar", dir: rtl` and ignored the render options, so an English/LTR tenant printed an RTL card with Arabic-only labels. The report card also fell back to fabricated values (`studentName "الطالب"`, `attendance "100%"`, Arabic praise `remarks`, `academicYear "1447-1448"`, `grade "ممتاز"`) when a key was absent. | `lang`/`direction` are injected into the data file (inferred from the payload when not supplied) and applied via `#set text(lang, dir)`; the report card uses an ar/en label dictionary and prints empty/`-` for unknown values. `resolveTypstLocale` is exported and tested. |
| F4 | **P2** | The bundled font directory was never passed to Typst (`--font-path` only when a caller supplied `fontDir`, and none did), and `TYPST_FONT_DIR` was documented but unused. | Always pass `options.fontDir ?? TYPST_FONT_DIR ?? templates/fonts/assets` when it exists. |
| F5 | **P2** | The PDF queue ran concurrency 4 while the Typst semaphore (2) is per-process; sandboxed PDF workers are forks, so up to four Typst processes × 512 MB child heaps could overlap. | PDF queue concurrency defaults to 2 (the Typst cap), overridable with `PDF_RENDER_CONCURRENCY`. |
| F6 | P3 | The server report-card PDF runner has no enqueue path (orphaned); the live report card is the client template engine + print window. | Documented; the pipeline is fixed for correctness if wired. |
| F7 | P3 | Client print kept unresolved `{{token}}` placeholders in text labels, so an unbound `Roll: {{rollNumber}}` printed literally. | `resolveElementText` strips unresolved tokens in print mode (the editor keeps them visible), with tests. |
| F8 | **P2** | The broadsheet exporter buffered the whole grid (≤50k rows) plus the joined CSV string plus the artifact copy in the 512 MB sandbox; the 25 MB artifact cap could also reject a large legitimate export. | The exporter now streams the CSV to storage page by page through a `PassThrough` with backpressure, abort checks and per-cell `escapeCsvCell`, and registers the artifact with `saveStreamedExportArtifact`. Tests cover formula-leading names/roll numbers, multi-page streaming and abort. |
| F9 | P3 | The exam CSV export (≤10k metadata rows) stays buffered/offset-paged; no gazette or transcript exporter exists. | Documented. |
| F10 | P3 | Marks import is CSV-only; no XLSX reader. | Documented design. |
| F11 | — | Formula injection, roll-number matching, bounds, blank-cell rejection and OCC/gate for marks import were re-verified. | Verified (existing tests). |
| F12 | **P2** | `loadExaminationsAnalytics` issued four sequential statements, each re-scanning every tenant mark (the CTE was inlined per statement; the grade query re-joined). | One statement: `WITH scored AS MATERIALIZED (…)` + `UNION ALL` branches (subject rates, grade histogram, top performers, section averages) with `row_number()` limits and a `sort` column. Tests assert a single `tx.execute`. |
| F13 | **P2** | No covering index for the analytics/metrics scans and no `(class, student)` composite for the section-average join. | Added to `src/scripts/perf_concurrent_indexes_and_stats.sql`: `exam_results (workspace, exam_id) INCLUDE (student_id, marks_obtained, grace_marks, updated_at)` and `enrollments (workspace, class_id, student_id) WHERE deleted_at IS NULL` (run out of band via `create-index-concurrently.ts`). |
| F14 | P3 | Command metrics scan all marks per dashboard load; widgets run 2–3 indexed statements per widget on the (small) exams table. | Mitigated by the covering index; widgets documented as bounded. |
| F15 | P3 | Widget `gt`/`lt` filters passed `Number(value)` unvalidated (non-finite reached `::numeric`). | Non-finite filter values are ignored. |

## Verified sound

- HTML certificate/report-card print: `printHtmlDocument`/`buildPrintWindowHtml` set `lang`, `dir`,
  `@page` and the shared print font stack; per-element direction is resolved from the script
  (`isRtlText` covers Arabic/Urdu/Persian/Hebrew) with the app direction as fallback.
- Field elements print empty instead of `{field}`; table rows distinguish editor placeholders from
  print; template print windows sever `opener` and escape the title.
- Marks import: roll resolved against the roster (ambiguity errors), exam-total +
  `MAX_MARKS_OBTAINED` bounds, blank rejected, deterministic ids, published exams refused,
  attendance/roster/override gate before any write.
- CSV escaping neutralises `= + - @ |`/whitespace formulas (negative numbers preserved); the XLSX
  serializer writes leading `=`/`+`/`@` as strings (other modules).
- Typst compile writes to a temp file (no PDF buffering), 15 s timeout, 1 MB `maxBuffer`, SIGKILL,
  temp-dir cleanup.

## Deferred (recorded)

- **Admit cards / roll slips** need a timetable/room model and a document type.
- **Transcripts** need a term/session aggregate entity (the term report card is a client-side
  aggregate of selected exams).
- **Server batch report cards** would be one job per student chunk on the PDF queue; the client
  preview's `breakAfter` is the current batch-print primitive.
- **Gazette export** and **XLSX marks import** are not implemented.
- Report-card labels are Arabic/English; Urdu/Persian label translations are deferred (those locales
  render RTL with English labels).
- The server PDF pipeline remains unwired; a future enqueue path must pass `lang`/`direction` from
  the request/tenant preferences.

## Operational note

```bash
pnpm --filter mms-backend tsx src/scripts/create-index-concurrently.ts \
  --file src/scripts/perf_concurrent_indexes_and_stats.sql
```

The two new indexes are created concurrently; they are not in a migration because `exam_results` and
`enrollments` are hot tables and a deploy-time plain build would block writes. Analytics correctness
does not depend on them.

## Verification

```bash
pnpm typecheck
pnpm --filter mms-backend test
pnpm --filter @mms/shared test
pnpm --filter mms-frontend test
pnpm --filter mms-backend test:db
node scripts/check-examinations-test-matrix.mjs
node scripts/ci/check-examinations-route-injection.mjs
pnpm check:docs && pnpm check:i18n
```
