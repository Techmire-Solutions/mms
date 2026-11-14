# Obligations Templates, Import/Export & Analytics Audit

Review of the printable-document integration, bulk import/export pipelines and reporting queries for the Obligations module.

**Status: reviewed.** One real defect (the import blueprint described the wrong document) and two missing guards around the receipt template are fixed. The export and analytics paths were verified rather than changed. Three briefed capabilities — statements, demand notices, clearance certificates — and the whole aging family do not exist in this module, and the report says so instead of auditing fiction.

---

## 0. Capability matrix

| Briefed | Reality (verified) |
|---|---|
| Printable **Obligation Statements** | Absent. |
| **Demand / Due Notices** | Absent — and impossible to derive: a receipt has no `due_date`. |
| **No-Dues / Clearance Certificates** | Absent. The only dues authority is the **session-completion gate**; a certificate is its product surface, not the receipt's. |
| Printable **receipt** | **Present and integrated.** `mms_invoice_template` layout, `DocumentTemplateEditor` + `InvoicePrintPreview` through the shared `DocumentTemplate` renderer, persisted server-side (`documentTemplatesApi`), 4 presets, 20 tokens. |
| **Batch PDF** memory bounds | No server-side PDF and no batch path for obligations: the receipt prints one A6 page in the browser. The batch-OOM question has no surface here. |
| CSV **bulk import** (blueprint validation, contact matching, row errors) | Endpoint answers **503** (no runner). The **blueprint was the wrong document** — fixed (T5). Contact matching and row-level errors belong to the future runner (D2). |
| **XLSX** import/export | Not offered; CSV only. |
| **Streaming exporters** | The shared `createModuleExportService` / `csvExportStreamFactory` path serves contacts and others; obligations uses its own paged, capped builder (added in the async audit). Both are formula-injection safe. |
| **Aging 30/60/90**, collection efficiency, waiver totals | **None exist.** No `due_date`, `status` or waiver on a receipt; aging is a Finance-invoice concern. |

---

## Findings

### T — Templates

| # | Sev | Finding | Status |
|---|---|---|---|
| **T1** | — *(verified good)* | The engine integration is sound: 20-field catalogue ↔ **exactly 20** resolver cases, labels localized under `obligations.invoiceTemplate.field.*` (20 keys in en **and** ar; global `check:i18n` enforces locale parity), 4 preset keys, and **RTL is pinned** — `templateRenderParity.test.tsx` asserts `dir="rtl"` for Arabic in both the editor canvas and the printed page, and documents the divergence it was written for (a table branch missing, RTL ignored, different QR payload). | Verified |
| **T2** | MEDIUM | **The receipt surface was missing from the template-field i18n parity test.** `templateFieldI18n.test.ts` covered finance, examinations, hasanat and student-card; obligations was absent, so a token added without a label key would ship untranslated with nothing failing. | **Fixed** |
| **T3** | MEDIUM | **Catalogue ↔ resolver parity was coincidental.** The 20↔20 match held but nothing pinned it; dropping a field on one side makes a saved layout print a blank token, invisibly. | **Fixed** |
| **T4** | — *(capability)* | No statement / demand / clearance templates; no server Typst render for obligations (accounting statements use it). | Recorded (D1, D4) |

### I — Import / export

| # | Sev | Finding | Status |
|---|---|---|---|
| **T5** | **HIGH** | **The import blueprint described the tasks document.** `obligationsImportRowSchema` declared `title`, `status`, `dueDate` (none exist on a receipt), required **no** receipt field, and was `.passthrough()` — so a real row passed unvalidated and the invented columns were carried silently. The UI dialog builds its columns from `obligationsTransferSchema` (the SSOT), so the two disagreed and "blueprint validation" was not performed at all. | **Fixed** |
| **T5b** | MEDIUM | **The 503 guard ran before body validation**, so a malformed import body was answered "not available on this deployment" — which is how the wrong blueprint stayed invisible. | **Fixed** (validate → then capability check) |
| **T6** | — *(verified good)* | Export is **formula-injection safe** (`buildCsvContent` → `escapeCsvCell`), **deterministic** (`ORDER BY id` makes offset paging safe), capped at **20 000 rows → 413** (≈4 MB worst case), and **abort-aware**. The client-side report export (`ExportToolbar` → `sanitizeExportValue`) also neutralises formulas, with a negative-number carve-out. | Verified |

### A — Analytics

| # | Sev | Finding | Status |
|---|---|---|---|
| **T7** | — *(verified good)* | `aggregateObligationsReport` filters on indexed columns (`workspace_date_active_idx`, type, rep, active/deleted), casts the **parameter** to `date` (never the column to text), and sums `numeric::text`; the command metrics are index-friendly too. No unindexed aggregation or slow-query pattern found; date filters are validated at the edge (`isoDateSchema`). | Verified |
| **T8** | — *(capability)* | No 30/60/90 aging, collection-efficiency ratio or waiver totals — there is no due/status/waiver domain to bucket. | Recorded (D3) |

---

## 1. What was applied

### 1.1 A receipt import blueprint (T5, T5b)

`obligationsImportRowSchema` is now the document the dialog asks for, mirroring `obligationsTransferSchema`:

| Field | Rule |
|---|---|
| `receiptNo` | required, 1..100 |
| `receivedDate` | required, `isoDateSchema` |
| `donorName` | required, 1..200 |
| `representative` | required, 1..200 |
| `amount` | required, non-negative decimal, **≤ 2 dp**; a numeric input is stringified before validation so a float that is not exactly representable is rejected rather than rounded |
| `currency` | optional, 3..10 |
| `paymentMode` | optional, enum `Cash \| Online` (the receipt DTO's own enum) |
| `reference` | optional, ≤ 200 |

The row is `.strict()`: the tasks columns are now **rejected** instead of silently carried. The envelope (`rows`, `label`, `idempotencyKey`, ≤ 500 rows) is unchanged, and the route validates the body **before** checking for a runner, so a wrong document is a 400 rather than a 503.

### 1.2 Template guards (T2, T3)

- `templateFieldI18n.test.ts` now includes the `obligations-receipt` surface (all 20 field label keys + the 4 preset keys).
- New `invoiceTemplateTokenParity.test.ts`: every catalogue field resolves to non-empty, readable text from a complete payload (no raw ids), an unknown token yields `""` rather than throwing, and a missing collection yields `""`.

---

## 2. Verification

| Command | Result |
| --- | --- |
| `pnpm typecheck` | 6/6 packages |
| `pnpm --filter @mms/shared test` | **2 405** tests (293 files), incl. 12 new blueprint tests |
| `obligations.integration.test.ts` | **19** tests, incl. the tasks-shaped import body now returning **400** |
| import-adjacent backend suites | **311** tests / 39 files (the guard reorder affects every module's import route) |
| frontend template suites | **38** tests / 6 files |
| `check-code-norms` · `check-docs` · `check-shared-structure` · `check:i18n` | held |

## 3. Deferred

| ID | Item |
|---|---|
| **D1** | Statement, demand/due-notice and no-dues/clearance-certificate templates. A clearance certificate needs the session-completion gate's dues decision — a product design, not a renderer change. |
| **D2** | The `obligations:import` job runner (donor/type/rep name→id resolution, wakala guard per row, per-row rejection report) consuming the new blueprint. |
| **D3** | Aging (30/60/90), collection efficiency and waiver analytics — they require a due/status/waiver domain the module does not have. |
| **D4** | Server-side Typst rendering for obligation receipts (shaped RTL, auditable output) and any true batch/campaign PDF with a page budget per job. |
| **D5** | XLSX export for the receipt directory. |
| **D6** | The SSOT `obligationsTransferSchema` cannot express an obligation **type** (only donor/rep names), so the future runner has no column to resolve it from — the schema needs a `type` field before D2 can be exact. |

## 4. Assumptions

1. Aligning the import blueprint with the SSOT is safe: `obligationsImportRowSchema` has no consumer beyond the route body schema, and no runner exists to break.
2. Validating the body before the capability check is the right order for every module: a malformed request is a client error regardless of deployment capability, and the "never accept a row we cannot process" guard still precedes enqueue. The import-adjacent suites confirm no regression.
3. The template engine's RTL behaviour needed no change — it is already pinned by `templateRenderParity.test.tsx`.
4. Not inventing due dates, statuses or waivers is correct: those capabilities do not exist, and the report records the gap rather than auditing fiction.
