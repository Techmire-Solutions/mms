---
name: mms-data-import
description: Governs bulk CSV/tabular import (ingestion, mapping, dry-run, batch upserts, worker). Use when CSV dialogs, /import endpoints, batch onboarding. Do NOT use for backup wipe-restore (use mms-backup-restore), form creation (use mms-form-architecture), or report export (use mms-reports-export).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Bulk CSV Data Import & Onboarding

**Rules (norms SSOT):** `mms-api-interface.md` §5 (bulk upsert contracts) · `mms-data-layer.md` §1 (schema & RLS) · `mms-reports.md` §3 (field whitelist & 1:1 header symmetry) · `mms-core.md`.

## When to use

- Building or modifying module CSV import dialogs (e.g. Contacts, Faculty, Students, Users)
- Registering module POST `/import` routes via `registerModuleCsvImportRoutes`
- Implementing client-side header mapping, validation dry-runs, and template downloads
- Processing queued import jobs via BullMQ background workers with row-level error reporting

## 1. Domain Invariants & Standards

- **Standard Route Helper**: Every module POST `/import` route must be registered using `registerModuleCsvImportRoutes` (`apps/api/src/lib/registerModuleCsvImportRoutes.ts`), which enforces body limits, tenant isolation, idempotency keys, and audit event capture.
- **Transfer Schema SSOT**: Define each importable module's columns once via `createModuleTransferSchema` (`packages/contracts/src/dataTransfer/core/moduleTransferSchema.ts`, registered through `moduleTransferRegistry`). The single `fields` array derives the import mappings, template columns, and export columns together, enforcing the field whitelist (system metadata keys stripped) and 1:1 header symmetry with the exporter — the same SSOT the export side consumes (`mms-reports.md` §3).
- **Dry-Run Validation**: Import dialogs must provide a dry-run preview stage verifying required headers, parsing types, and highlighting row errors before final queuing.
- **Idempotency & Queuing**: Large imports (> 50 rows) are dispatched as asynchronous BullMQ background jobs with status tracking and artifact error logs (`mms-background-jobs`).
- **Bulk Upsert Semantics**: Import writes adhere to bulk PUT/upsert contracts (`mms-api-interface.md` §5). Never wipe or truncate missing existing rows during an import batch.
- **Column Parity with the Exporter**: every column the module's CSV/VCF exporter writes must parse into a schema-valid import row — including nested relationship/card fields. The parser's output is validated by the contract, so an unknown key (e.g. `relationship_email`) becomes a 400 for the whole file. Add a round-trip test that parses an exported file.
- **One Config Load Per Batch**: the worker loads tenant config once (`loadContactWriteContext` pattern) and runs in batch mode — per-record broadcast, cache invalidation, duplicate-scan invalidation, and derived-projection reconciliation are suppressed and executed once after the loop. Per-record transactions are acceptable; per-record config reads and live updates are not.
- **Derived Rows After Import**: collect successful entity ids and run one derived-state reconcile after the batch (contacts: `reconcileContactSystemTags`). Reserved/system-managed values in an import file are filtered, not persisted as manual duplicates.

## 2. Implementation Map

| Concern | Path |
|---------|------|
| Transfer Schema SSOT | `packages/contracts/src/dataTransfer/core/moduleTransferSchema.ts` |
| Backend Import Helper | `apps/api/src/lib/registerModuleCsvImportRoutes.ts` |
| Import Integration Tests | `apps/api/src/__tests__/moduleCsvImport.test.ts` |
| Background Worker Service | `apps/api/src/services/backgroundJobWorkerService.ts` |
| Users Import Dialog | `apps/tenant-web/src/tenant/features/users/components/UsersCsvImportDialog.tsx` |

## 3. Verification Checklist

```
- [ ] Backend route registered with registerModuleCsvImportRoutes and bodyLimit: 2 * 1024 * 1024
- [ ] canWrite permission guard verified on POST /import
- [ ] Idempotency key supported to prevent duplicate queue submissions
- [ ] RFC 8785 audit event logged on import job dispatch
- [ ] Client import dialog provides downloadable CSV template and column mapping
- [ ] Verify: pnpm --filter mms-api test src/__tests__/moduleCsvImport.test.ts
- [ ] Verify: pnpm typecheck
```

## Related skills

`mms-background-jobs`, `mms-queue-ops`, `mms-audit-trail`, `mms-backend-api`, `mms-form-architecture`.
