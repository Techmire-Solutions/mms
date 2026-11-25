# Centralised Import & Export System — Architecture & Module Coverage

> **Status: shipped and being extended — not a greenfield proposal.**
> MMS already operates a single, shared **data-transfer engine** (`@mms/shared` →
> backend route/job helpers → shared frontend components). This document is the
> *current-state* reference and the recipe for extending it, written against the
> live codebase. It supersedes any earlier draft that framed this as a target design.

---

## 1. The shared engine (what already exists)

Import and export are **not** per-module bespoke pipelines. Every module entity that
supports bulk transfer plugs into one cross-module engine split across three layers.

### 1.1 Shared contracts & SSOT — `@mms/shared`

Canonical entry point: [`packages/contracts/src/dataTransfer/index.ts`](../packages/contracts/src/dataTransfer/index.ts)

| Concern | Path |
| --- | --- |
| Transfer schema factory (SSOT) | [`core/moduleTransferSchema.ts`](../packages/contracts/src/dataTransfer/core/moduleTransferSchema.ts) — `createModuleTransferSchema` |
| Module coverage registry | [`registry/moduleTransferRegistry.ts`](../packages/contracts/src/dataTransfer/registry/moduleTransferRegistry.ts) |
| Import contracts | [`core/importTypes.ts`](../packages/contracts/src/dataTransfer/core/importTypes.ts) — `ImportSpec`, `ImportResult`, `ImportRowError` |
| Export contracts | [`core/exportTypes.ts`](../packages/contracts/src/dataTransfer/core/exportTypes.ts) — `ExportSpec`, `ExportColumn`, `ExportFormat`, `ExportCellExtractor` |
| Import pipeline | [`import/importPipelineRunner.ts`](../packages/contracts/src/dataTransfer/import/importPipelineRunner.ts) — `runImportPipeline`, `validateImportRows` |
| Export grid builder | [`export/buildExportGrid.ts`](../packages/contracts/src/dataTransfer/export/buildExportGrid.ts) — `buildExportGrid`, `yieldExportGridChunks` |
| Field visibility filter | [`export/filterExportColumns.ts`](../packages/contracts/src/dataTransfer/export/filterExportColumns.ts) |
| Serializer registry | [`export/exportSerializerRegistry.ts`](../packages/contracts/src/dataTransfer/export/exportSerializerRegistry.ts) — CSV/JSON shared; XLSX server-only |
| Per-module schemas | [`schemas/index.ts`](../packages/contracts/src/dataTransfer/schemas/index.ts) |

`createModuleTransferSchema(config)` is the single source of truth that derives, from one
`fields` array, the export columns, the cell extractor, the import mappings, the template
columns, and the `ExportSpec` — guaranteeing:

- **Field whitelist invariant** — internal system metadata keys (`id`, `_id`, `uuid`,
  `tenantId`, `tenant_id`, `createdAt`, `updatedAt`, `deletedAt`, `version`, `__v`,
  `syncStatus`, `shardedHash`, `hashChain`) are stripped at the root generation layer via
  `filterNonMetadataColumns()` / `isSystemMetadataKey()`.
- **Bidirectional (round-trip) symmetry** — an exported header is 1:1 the primary import
  header (`field.label`). Any valid export must re-import without a column mismatch; each
  exporter needs a round-trip test (see §2.1).

The import pipeline is deterministic and per-row-error tolerant:
`parse → Zod validate → sanitize (deepSanitizeStrings) → optional transform → batch-persist`.
Per-row failures are collected as `ImportRowError` and never throw the whole job.

### 1.2 Backend route helpers & job runners

| Concern | Path |
| --- | --- |
| Standard POST `/import` | [`lib/registerModuleCsvImportRoutes.ts`](../apps/api/src/lib/registerModuleCsvImportRoutes.ts) |
| Standard POST `/export/csv` | [`lib/registerModuleCsvExportRoutes.ts`](../apps/api/src/lib/registerModuleCsvExportRoutes.ts) |
| Import job runner | [`lib/registerModuleCsvImportJobRunner.ts`](../apps/api/src/lib/registerModuleCsvImportJobRunner.ts) |
| Export job runner | [`lib/registerModuleCsvExportJobRunner.ts`](../apps/api/src/lib/registerModuleCsvExportJobRunner.ts) |
| Generic service factories | [`lib/createModuleImportService.ts`](../apps/api/src/lib/createModuleImportService.ts), [`lib/createModuleExportService.ts`](../apps/api/src/lib/createModuleExportService.ts) |
| Streaming CSV writer | [`lib/csvExportStreamFactory.ts`](../apps/api/src/lib/csvExportStreamFactory.ts) |
| Serializer resolution | [`lib/exportSerializerResolver.ts`](../apps/api/src/lib/exportSerializerResolver.ts), [`lib/xlsxExportSerializer.ts`](../apps/api/src/lib/xlsxExportSerializer.ts) |
| Contacts VCF connector | [`lib/registerContactsVcfExportJobRunner.ts`](../packages/modules/contacts/src/backend/jobs/registerContactsVcfExportJobRunner.ts) |
| Worker orchestration | [`services/backgroundJobWorkerService.ts`](../apps/api/src/services/backgroundJobWorkerService.ts), [`services/backgroundJobRunnerService.ts`](../apps/api/src/services/backgroundJobRunnerService.ts) |
| Export artifact store | [`services/exportArtifactService.ts`](../apps/api/src/services/exportArtifactService.ts) |

`registerModuleCsvImportRoutes(fastify, opts)` enforces, in one place for every module:

- `bodyLimit` default **2 MiB** (`bodyLimit: 2 * 1024 * 1024`).
- `canWrite(user)` RBAC before enqueue (403 `{ type: 'forbidden' }`).
- Zod `bodySchema` validation **before** the capability check (a malformed body is a 400,
  not a hidden 503).
- A fail-closed runner check (`hasBackgroundJobRunner('<moduleId>:import')`) → 503 rather
  than enqueuing a doomed job.
- **Idempotency** — explicit `idempotencyKey` or a deterministic job key derived from the
  payload, preventing duplicate queue submissions.
- An RFC 8785 audit event on dispatch.

`registerModuleCsvExportRoutes(fastify, opts)` adds `canRead(user)` and trash/delete
guards and a `moduleExportAuditBodySchema` audit row, so a module cannot silently bypass
field visibility or soft-delete policy.

### 1.3 Frontend components

| Component | Path | Role |
| --- | --- | --- |
| `ModuleImportDialog` | [`components/app/ModuleImportDialog.tsx`](../packages/fe-core/src/components/ModuleImportDialog.tsx) | Generic import UI: template download, file drop, header/row/preflight errors, progress, completion |
| `StandardModuleCsvImportDialog` | [`components/app/StandardModuleCsvImportDialog.tsx`](../packages/fe-core/src/components/StandardModuleCsvImportDialog.tsx) | SSOT wiring to `useModuleCsvImportActions` |
| `ExportToolbar` / `ExportToolbarCompact` | [`components/app/ExportToolbar.tsx`](../packages/fe-core/src/components/ExportToolbar.tsx) | Column/format/scope selection; small exports inline, large via job |
| `BackgroundJobsTray` | [`components/app/BackgroundJobsTray.tsx`](../packages/fe-core/src/components/BackgroundJobsTray.tsx) | Live job progress + owned-artifact download links |
| Actions | [`lib/backgroundJobs/`](../apps/tenant-web/src/lib/backgroundJobs/) | `useModuleCsvImportActions`, `useModuleServerCsvExportActions`, `useGenericModuleExport`, per-module `startServer*` |

---

## 2. Cross-cutting standards (modern best practices)

### 2.1 Data hygiene & round-trip parity

- **One config load per batch.** The worker loads tenant config/lookups once per batch
  (the `loadContactWriteContext` pattern) and runs in batch mode. Per-record broadcasts,
  cache invalidation, duplicate-scan invalidation, and derived-projection reconciliation
  are suppressed and executed once after the loop. Per-record transactions are acceptable;
  per-record config reads and live updates are not.
- **Derived rows after import.** Collect successful entity ids, then run one
  derived-state reconcile after the batch (contacts: `reconcileContactSystemTags`).
  Reserved/system-managed values in a file are filtered, never persisted as manual duplicates.
- **Export → import parity.** Every column an exporter writes must parse into a
  schema-valid import row; add a round-trip test that parses an exported file. An unknown
  key (e.g. `relationship_email`) must not 400 the whole file silently.
- **Bulk upsert semantics.** Import writes follow bulk PUT/upsert contracts
  (`mms-api-interface` §5). Never wipe or truncate missing existing rows during a batch.

### 2.2 Security & tenant isolation

- **Tenant RLS everywhere.** Transactions run under `SET LOCAL app.current_tenant`;
  job execution re-applies tenant + permission + visibility + soft-delete rules. Tenant A
  cannot read, cancel, or download Tenant B's jobs or artifacts.
- **Module access gates** (`mms-auth-security` §3). Backend: `registerModuleAccess` +
  `MODULE_ROUTE_ACTION_RULES`; frontend `TENANT_APP_ROUTE_ACCESS` + `useModuleAccess()`.
  Denials carry codes `MODULE_NOT_GRANTED | MODULE_DISABLED | PERMISSION_DENIED |
  MODULE_ACCESS_UNAVAILABLE`. Frontend visibility is never a security boundary.
- **RBAC verbs.** `canWrite` / `canRead` / `canDelete` / `canExport` / `canViewSetup`
  via `useModulePermissions(MANIFEST)`; backend preHandlers enforce authoritatively.
- **Credential redaction.** Passwords, session tokens, OTP/MFA secrets are banned from any
  import/export schema. Bulk-imported users are created `INVITED` and dispatched onboarding
  via the messaging/notification pipeline. Export the access matrix (User, Role, Scope,
  Last Login, soft-delete status) — never secrets.
- **PII masking.** Sensitive student/guardian/contact PII is masked unless the caller holds
  an explicit export-PII clearance; every PII export is logged to audit **before** streaming.
- **Formula-injection protection.** Escape `=`, `+`, `-`, `@` prefixes on untrusted text
  cells (CSV/Excel/PDF) while preserving legitimate signed numeric cells as numbers.
- **Mass-assignment of server-owned projections.** Derived/system-managed fields are
  stripped before validation and again at the write choke point; bulk attempts to edit
  reserved values are rejected with `400`.

### 2.3 Performance & streaming (`mms-performance` §1–2)

- **Stream, don't buffer.** CSV always streams; large Excel goes through ExcelJS stream
  pipes; in-memory caps are enforced *inside* the generator before a chunk is yielded.
  Draining the generator and checking afterwards bounds nothing.
- **Size gates → background:**

  | Format | Inline (FE) | Background (BullMQ) |
  | --- | --- | --- |
  | Print | any (CSS `@media print`) | — |
  | CSV | always streamed | server job streams to artifact |
  | Excel | ≤ 500 rows | > 500 rows (ExcelJS stream pipe) |
  | PDF | ≤ 200 rows (`jspdf`) | > 200 rows (headless **Typst** worker) |

- **Import offload.** Large imports (> 50 rows) dispatch as asynchronous BullMQ jobs with
  status + artifact error logs. Default batch cap `CSV_IMPORT_MAX_BATCH_DEFAULT` = 500.
- **Progress.** Background export jobs emit BullMQ progress at ≥ 10 % increments; the tray
  and WebSocket (`/api/ws`) surface live progress.
- **BiDi document engine.** For Urdu Nastaliq / Arabic / Farsi PDFs, use the headless
  **Typst** compiler with native HarfBuzz shaping: Fastify → BullMQ → Typst worker →
  Redis PubSub → object store. Not jsPDF for RTL-heavy documents.

### 2.4 Audit & compliance (`mms-audit-trail`, `mms-reports-export`)

- Import dispatch and every sensitive queued operation (export, bulk delete/restore,
  import, merge, messaging, sync recovery) emit an immutable audit event.
- Propagate W3C `traceparent` as `correlation_id` into audit records and APM traces
  (`AsyncLocalStorage`) to link worker execution with the request that enqueued it.
- **Audit-export attestation.** Streams of `audit_trail_events` carry the chain hash,
  published Merkle root proof, and verification status; the export itself emits an
  `action_type: 'VIEW'` on `audit_trail_events` ("auditing the auditor").
- **Data minimization.** Compliance exports strip raw decrypted PII unless requested under
  an authorized break-glass session.

### 2.5 UX, accessibility, i18n & BiDi

- Import UX is a single flow: **download template → drop file → preflight/dry-run summary
  (missing headers, row errors, preflight errors) → progress → completion**.
- Exports share one toolbar (columns + format + scope) and one `BackgroundJobsTray`;
  download links are shown only for artifacts owned by the current user.
- All copy and chart text go through `t()` across `en` / `ar` / `ur` / `fa`; layouts use
  logical CSS (BiDi tokens) so RTL mirrors correctly.
- Recharts is lazy-loaded via `SafeResponsiveContainer`; report/export surfaces run the
  a11y (axe) and BiDi smoke gates (see §5).

---

## 3. Module coverage

### 3.1 Implemented (schema registered)

Registry SSOT: [`moduleTransferRegistry.ts`](../packages/contracts/src/dataTransfer/registry/moduleTransferRegistry.ts).

| Module | Schema(s) | Priority | Notes |
| --- | --- | --- | --- |
| Contacts | `contactsTransferSchema` | P1 | + specialized VCF export, Google two-way sync, merge (external connectors on top of the engine) |
| Students | `studentsTransferSchema` | P1 | guardians, fee structure, custom fields |
| Faculty | `facultyTransferSchema`, `facultyDesignation…`, `facultyDepartment…` | P1 | |
| Sessions | `sessionsTransferSchema` | P1 | |
| Enrollments | `enrollmentsTransferSchema` | P1 | |
| Users | `usersTransferSchema` | P2 | secret-free; `INVITED` + onboarding dispatch |
| Question Bank | `questionBankTransferSchema` + mapping | P2 | |
| Accounting | `accountingTransferSchema` | P2 | COA, journal vouchers, subledger; fiscal locks + debit=credit |
| Finance | `financeTransferSchema` | P2 | invoices, fee collection, payment terms |
| Attendance | `attendanceTransferSchema` | P3 | + matrix formatter (color-coded cells) as an export plugin |
| Academic Calendar | `academicCalendarTransferSchema` (`attendance-calendar`) | P3 | queued import via the shared engine |
| Examinations | `examinationsTransferSchema`, `examinationsMarks…` | P3 | |
| Hasanat | `hasanatTransferSchema` | P3 | |
| Obligations | `obligationsTransferSchema` | P3 | |
| Tasks | `tasksTransferSchema` | P3 | |
| Messaging | `messagingTransferSchema` | P3 | templates |
| Workshops | `workshopsTransferSchema` | P3 | event export via the shared engine; participant import stays relational |

> **Contacts export note:** `contactsTransferSchema` is the import/template SSOT (fixed fields, round-trip
> tested). The server CSV export is **field-config-aware** — it renders custom blueprint columns and
> RLS field visibility via `buildContactsExportRows`/`filterContactExportColumnsForViewer`, which a
> static schema cannot express — so it does not route through `schema.buildExportGrid`. This is an
> intentional divergence, not a bypass: both paths share the same field whitelist + PII sanitization.
>
> **Contacts import note:** contacts import is substantively conformant to the shared engine — a queued
> `contacts:import` job with role re-check at execution, one-config-load-per-batch, post-batch
> system-tag reconciliation, an aggregate RFC-8785 audit, and deterministic idempotency. It retains a
> `{contacts}`-shaped payload and a subject-scoped `auditContact` (which the generic registrar cannot
> reproduce), so it uses a bespoke route/runner rather than `registerModuleCsvImportRoutes`.
>
> **Grid runner coverage is complete.** The previously-missing runners are all registered, so no
> schema'd module's `/import` or `/export/csv` route 503s for a missing runner:
> - `users:import` — bulk INVITED provisioning (no secrets, role-assignment guard).
> - `finance:export` / `finance:import` — invoice transfer (recipient-name → student id).
> - `obligations:import` — name→id resolution (donor/type/representative/currency) + wakala + ledger.
> - `attendance:import` — daily register (person/session/class name→id + policy guards).
>
> The two name-based resolvers (obligations donor, attendance person/session/class) resolve names to
> ids once per batch via the existing student/contact/session catalogs and reuse the module write
> guards, so the imports enforce the same invariants as the form/route write paths.

### 3.2 Genuine gaps (no transfer schema yet)

These backend modules do **not** yet have a `createModuleTransferSchema` and are the real
remaining work — not "build the engine", but *onboard these adapters*:

| Module | Gap |
| --- | --- |
| Audit (`audit`) | Export-only path exists via a dedicated audit-export route with Merkle attestation; no `ExportSpec` |
| Documents | Print-template assets (server-authoritative layouts) — not grid export |
| Notifications | Preference/template export not yet schema'd |
| Platform console | Tenant-config portability (lookups, field blueprints, notification templates) not yet JSON import/export |
| Integrations | External connectors (Google, gateways) are purpose-built sync engines, not grid transfer |
| Saved reports | Definitions are live logic (save filters/columns/aggregates), not snapshots |

### 3.3 Explicit exemptions (documented, non-grid)

These are **not** onboarding gaps — they are legitimately non-grid surfaces and stay on
purpose-built paths. Rationales recorded so a future review does not re-litigate them:

| Module | Exemption rationale |
| --- | --- |
| `audit` | Append-only, shard-hash-chained, Merkle-rooted, crypto-shredded compliance log; import would break the hash chain. Export uses the dedicated tamper-evident `/api/audit/export` route. |
| `notifications` | Ephemeral per-user in-app read-state feed; templates/preferences already live under `messaging` and are covered by `messagingTransferSchema`. |
| `platform` | Separate apex console (not a tenant module). Any future tenant-config transfer is a singleton JSON snapshot — use the shared `jsonSerializer`, not a grid schema. |
| `documents` | Server-authoritative nested print-template layout/asset blobs (compare-and-set persistence), not tabular rows. |
| `integrations` | External two-way sync (Google Contacts OAuth, email/SMS/WhatsApp gateways); import/export would be meaningless and would leak credentials. |
| `savedReports` | Heterogeneous per-category `filters` JSON + live report-definition logic; CSV round-trip is lossy. Save logic, not snapshots. |

---

## 4. Adding a new module adapter (the recipe)

1. **Schema (SSOT).** Add `packages/contracts/src/dataTransfer/schemas/<module>TransferSchema.ts`
   using `createModuleTransferSchema({ moduleId, entityNounPlural, defaultFilename, fields,
   filterColumns })`. Export it from `schemas/index.ts` and register via
   `registerModuleTransferSchema`.
2. **Backend routes.** Call `registerModuleCsvImportRoutes` (POST `/import`) and
   `registerModuleCsvExportRoutes` (POST `/export/csv`) with `canWrite`/`canRead`,
   `bodySchema`, `moduleId`, `defaultLabel`, `entityNoun`, and audit action prefixes.
3. **Runners.** Register the import/export job runners under stable keys
   `<moduleId>:import` / `<moduleId>:export`; run in tenant context, re-apply permission +
   soft-delete + visibility, stream output, and store artifacts via `exportArtifactService`.
4. **Frontend.** Mount `StandardModuleCsvImportDialog` (or `useModuleCsvImportActions`)
   and the shared `ExportToolbar`/`BackgroundJobsTray`. Wire `onSuccess` to invalidate the
   module's TanStack Query caches.
5. **Round-trip test.** Parse an exported file and assert it re-imports cleanly.
6. **Module access gate.** Classify the new routes in `moduleAccessCoverage.test.ts` and,
   for app-shell surfaces, `TENANT_APP_ROUTE_ACCESS`.

---

## 5. Verification gates

- **Tenant/security:** cross-tenant isolation tests (Tenant A cannot read/cancel/download
  Tenant B's job or artifact); route security-matrix + `moduleAccessCoverage.test.ts`.
- **Round-trip:** import a freshly exported file and assert schema validity
  (`pnpm --filter mms-backend test src/__tests__/moduleCsvImport.test.ts`).
- **UI/a11y/BiDi:** axe smoke, focus-return, touch-target floors; BiDi class checks;
  Playwright E2E covering template download, dry-run error display, and async export
  completion (template download → tray → download).
- **Data-transfer invariants:** field-whitelist stripping, 1:1 header symmetry, streaming
  caps enforced inside generators, formula-injection escaping, soft-delete manifest
  compliance (`reportsIncludeDeleted` / `exportsIncludeDeleted`).
- **Ratchet commands:** `pnpm typecheck` · `cd apps/frontend && pnpm lint`.

---

## 6. Notes on naming vs. the legacy draft

| Legacy draft term | Actual MMS term |
| --- | --- |
| "Data Transfer Engine" (target) | `@mms/shared` dataTransfer namespace + backend route/job helpers (shipped) |
| `ModuleTransferAdapter` | `createModuleTransferSchema` → `ModuleTransferSchema` + `ModuleTransferConfig` |
| `TransferJobStatus` (9 states) | `BackgroundJobStatus` = `pending | running | completed | failed` |
| Calendar / Academic Catalog modules | legacy (`calendarImportSchemas.test.ts`, `academicCatalogRoutes.integration.test.ts` are orphaned tests under `apps/backend/src/__tests__/`); catalog is now faculty catalog + question bank |
| "chunked transactional execution, 250–500 rows/tx" | `runImportPipeline` chunks via `persist` callback; default batch cap 500 |
