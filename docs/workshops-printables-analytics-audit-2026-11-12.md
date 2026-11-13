# Workshops Printables, Import/Export & Analytics Audit — 2026-11-12

**Shared contracts:** DTOs, enums and Zod/static alignment are audited in
[workshops-shared-contracts-audit-2026-11-12.md](workshops-shared-contracts-audit-2026-11-12.md).

**Frontend/state:** page hierarchy, query invalidation and form UX are audited in
[workshops-frontend-state-audit-2026-11-12.md](workshops-frontend-state-audit-2026-11-12.md).

**Tests/CI:** coverage, concurrency and ratchets are audited in
[workshops-test-audit-2026-11-12.md](workshops-test-audit-2026-11-12.md).

**Scope:** document-template rendering of certificates/rosters/badges/sign-in sheets, CSV/XLSX
participant import and roster export, and the repository queries behind workshop metrics/reports.
Seventh in the series; companions:
[schema](workshops-schema-persistence-audit-2026-11-12.md),
[lifecycle](workshops-domain-lifecycle-audit-2026-11-12.md),
[subsystems](workshops-subsystems-audit-2026-11-12.md),
[API](workshops-api-layer-audit-2026-11-12.md),
[security](workshops-security-audit-2026-11-12.md),
[async queues](workshops-async-queues-audit-2026-11-12.md).

## 1. Findings

### Certificates & printables

| # | Sev | Finding | Evidence |
|---|---|---|---|
| P1 | **P1** | **Certificates ignored RTL.** `printHtmlDocument` accepts `language`/`isRtl`, but the workshop call passed only a title and HTML, so Arabic/Urdu/Farsi certificates printed `dir="ltr"` | `WorkshopCompletionSection.tsx` before this change; `printHtmlDocument.ts` |
| P2 | **P1** | **Unbounded batch certificate print (OOM risk).** Every selected certificate was concatenated into one HTML string in a single print window; the completion endpoint returns one row per participant with no cap | `targets.map(...).join("")` |
| P3 | **P1** | **No document-template integration and no other printables.** Certificates were a hardcoded HTML card with no tenant layout; name badges and sign-in sheets did not exist | `completionCertificateHtml.ts`; repository search |
| P4 | — | Positive: all user text passed through `escapeHtml`; the print window severs `opener`; `TemplateDocumentPreview` already supports script-based direction | `escapeHtml`, `printHtmlDocument`, `TemplateDocumentPreview` |

### Import / export

| # | Sev | Finding | Evidence |
|---|---|---|---|
| E1 | **P1** | **No CSV/XLSX participant importer.** The only import is the queued JSON `contactIds` job (and ≤100 synchronous bulk): no file upload, column mapping/blueprint, XLSX parsing or template download | `workshopParticipantsImportSchema`; generic `ModuleImportDialog` has no workshops consumer |
| E2 | P1 | **No streaming roster exporter.** Workshops never registered `createModuleExportService` / `registerModuleCsvExportJobRunner`; there is no roster CSV/XLSX endpoint or job | export registrations |
| E3 | P2 | Certificate template field/token mismatch risk if integrated without a payload contract | `TemplateDocumentPreview` `element.field` binding |
| E4 | — | Positive: `escapeCsvCell` neutralizes formula prefixes (`=`, `+`, `-`, `@`, whitespace-prefixed), XLSX writes literal strings, CSV streams 250-row pages, materialized exports cap at 10,000 rows, and the queued import is chunked with bounded errors | `core/csvUtils.ts`, `csvExportStreamFactory.ts`, `createModuleExportService.ts`, `workshopImportJob.ts` |

### Analytics

| # | Sev | Finding | Evidence |
|---|---|---|---|
| A1 | **P1** | **No dashboard widgets** for upcoming workshops, seat utilization, completion % or attendance drop-off; only the module strip (upcoming/ongoing/finished/participants) and the report table | `aggregateWorkshopsMetrics`, `WorkshopReportTable` |
| A2 | P1 | **Report lacked utilization/completion rates**; it exposed only raw participants/completed/certificates and attendance % | `workshopReportRowSchema`, `getReport` |
| A3 | P2 | **Aggregation indexes incomplete:** events filter `status` + dates but the partial date index omitted `status`; participant counts filter `deleted_at`/`waitlisted_at` but `(ws, workshop_id)` did not; attendance aggregates filter status without it in the index | repository queries; schema indexes |
| A4 | P2 | Reports load all active workshops with no pagination and then `inArray` every id (already deferred in the API audit) | `loadReportFacts` |

## 2. Implemented changes

### Certificate template, RTL and bounded batches

- `apps/frontend/src/tenant/features/workshops/lib/workshopCertificateTemplate.ts`:
  - `mms_workshop_certificate_template` key, typed `WorkshopCertificatePayload` (heading, statement,
    recipientName, courseName, period, issuedLabel, issuedOn), field definitions for the editor, and
    a factory A4-landscape layout. Elements bind via `field` (no `{{token}}` strings), so a
    field/payload mismatch is test-detectable.
- `WorkshopCertificatePrintModal.tsx` renders the current batch with `TemplateDocumentPreview` and
  prints through `printTemplateDocument`, passing `language`/`isRtl`. **`MAX_CERTIFICATES_PER_PRINT_BATCH
  = 50`** and Previous/Next batch navigation mean a 5,000-participant cohort never materializes a
  5,000-page DOM/string; per-participant print opens a one-row batch.
- Completion section now opens this modal instead of building certificate HTML; issue-then-print
  semantics are unchanged.
- `WorkshopCertificateTemplateEditor.tsx` wraps the generic `DocumentTemplateEditor` (tenant layout
  saved through `/api/templates/:key`, `settings.global.write`) and is exposed in Setup for
  `canEditSetup` users. Read-only staff print but cannot save.
- The certificate template test asserts every element field exists in the payload and every payload
  key has an editor field (no blank-field/token mismatch).

### Roster, sign-in sheet and name badges

- `workshopPrintables.ts` builds escaped, print-ready HTML for:
  - roster (bounded to `MAX_ROSTER_PRINT_ROWS = 500`, numbered, status column),
  - sign-in sheet (adds signature/date columns),
  - name badges (`MAX_BADGES_PER_PRINT = 100`, A4 sheet grid cards, explicit truncation notice).
- All three print through `printHtmlDocument` with the active `language`/`isRtl`; user names are
  escaped (`<script>` cannot execute in the same-origin print window).
- Buttons added to the participants section; a truncated print reports how many were printed.

### Analytics

- Migration **0247_workshop_analytics_indexes.sql** (+ journal/snapshot) adds:
  - `workshop_events_ws_status_dates_active_idx` on `(ws, status, start_date, end_date) WHERE
    deleted_at IS NULL` — metrics status/date buckets and report ordering.
  - `workshop_participants_ws_active_workshop_idx` and `..._active_status_idx` on
    `(ws, workshop_id[, status]) WHERE deleted_at IS NULL AND waitlisted_at IS NULL` — seat/roster and
    completion/certificate counts.
  - `workshop_attendance_ws_workshop_day_status_idx` on `(ws, workshop_id, day_on, status)` —
    attendance aggregates become index-only for the present/late filter.
- Report rows now expose `seatUtilizationPct` (participants ÷ capacity; `null` when capacity is
  null/0) and `completionPct` (completed ÷ participants; `null` when nobody registered), with unit
  tests for the null/one-decimal rules. Reports table shows both columns.

## 3. Deferred (decision-ready)

- **D1 CSV/XLSX participant import:** multipart + `ModuleImportDialog` blueprint (`contact_id` or
  `phone`/`email`), preflight contact resolution/duplicates, then enqueue the existing
  `workshops:import` job with resolved IDs. Needs XLSX parsing and a contact resolver.
- **D2 Streaming roster export:** CSV via `createModuleExportService`/`csvExportStreamFactory`
  (formula-safe, 250-row pages) and XLSX with the 10,000-row cap; no exporter exists today, so no
  new injection or memory surface exists yet.
- **D3 Attendance drop-off widget:** needs an agreed denominator (registered vs expected day-marks).
- **D4 Report pagination/limit.**
- **D5 Dashboard workshop widgets** (upcoming/utilization/completion/drop-off).

## 4. Verification

```bash
pnpm --filter @mms/shared typecheck && pnpm --filter mms-backend typecheck && pnpm --filter mms-frontend typecheck
pnpm --filter @mms/shared test     # 280 files / 2269 tests
pnpm --filter mms-backend test     # 521 files / 3685 tests
pnpm --filter mms-frontend test    # 1209 files / 4544 passed (2 skipped)
# workshop DB suites apply 0247 and remain green; migration/schema index tests added
pnpm run check:code-norms check:backend-structure check:backend-boundaries check:i18n check:migration-indexes
```

New tests: certificate template field/payload parity; print modal batch paging (50) and RTL/language
pass-through; printables escaping, caps and RTL; report rate math; 0247 migration/snapshot index
assertions. No import/export code changed, so the existing CSV/XLSX injection and streaming
backpressure suites remain the proof for the generic factories.
