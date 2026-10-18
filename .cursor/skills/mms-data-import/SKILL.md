---
name: mms-data-import
description: Governs bulk CSV and tabular data import workflows — file ingestion, column mapping, dry-run validation, batch upserts, and BullMQ worker execution. Use when adding or modifying CSV import dialogs, module POST /import endpoints, or batch data onboarding pipelines. Do NOT use for database-level wipe-restore backups (use mms-backup-restore), single-record form modal creation (use mms-form-architecture), or analytical reports export (use mms-reports-export).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Bulk CSV Data Import & Onboarding

**Rules (norms SSOT):** `mms-api-interface.mdc` §5 (bulk upsert contracts) · `mms-data-layer.mdc` §1 (schema & RLS) · `mms-core.mdc`.

## When to use

- Building or modifying module CSV import dialogs (e.g. Contacts, Faculty, Students, Users)
- Registering module POST `/import` routes via `registerModuleCsvImportRoutes`
- Implementing client-side header mapping, validation dry-runs, and template downloads
- Processing queued import jobs via BullMQ background workers with row-level error reporting

## 1. Domain Invariants & Standards

- **Standard Route Helper**: Every module POST `/import` route must be registered using `registerModuleCsvImportRoutes` (`apps/backend/src/lib/registerModuleCsvImportRoutes.ts`), which enforces body limits, tenant isolation, idempotency keys, and audit event capture.
- **Dry-Run Validation**: Import dialogs must provide a dry-run preview stage verifying required headers, parsing types, and highlighting row errors before final queuing.
- **Idempotency & Queuing**: Large imports (> 50 rows) are dispatched as asynchronous BullMQ background jobs with status tracking and artifact error logs (`mms-background-jobs`).
- **Bulk Upsert Semantics**: Import writes adhere to bulk PUT/upsert contracts (`mms-api-interface.mdc` §5). Never wipe or truncate missing existing rows during an import batch.

## 2. Implementation Map

| Concern | Path |
|---------|------|
| Backend Import Helper | `apps/backend/src/lib/registerModuleCsvImportRoutes.ts` |
| Import Integration Tests | `apps/backend/src/__tests__/moduleCsvImport.test.ts` |
| Background Worker Service | `apps/backend/src/services/backgroundJobWorkerService.ts` |
| Users Import Dialog | `apps/frontend/src/tenant/features/users/components/UsersCsvImportDialog.tsx` |

## 3. Verification Checklist

```
- [ ] Backend route registered with registerModuleCsvImportRoutes and bodyLimit: 2 * 1024 * 1024
- [ ] canWrite permission guard verified on POST /import
- [ ] Idempotency key supported to prevent duplicate queue submissions
- [ ] RFC 8785 audit event logged on import job dispatch
- [ ] Client import dialog provides downloadable CSV template and column mapping
- [ ] Verify: pnpm --filter mms-backend test src/__tests__/moduleCsvImport.test.ts
- [ ] Verify: pnpm typecheck
```

## Related skills

`mms-background-jobs`, `mms-queue-ops`, `mms-audit-trail`, `mms-backend-api`, `mms-form-architecture`.
