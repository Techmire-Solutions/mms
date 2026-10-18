---
name: mms-background-jobs
description: Implements or reviews MMS background jobs and queued processing — large exports, imports, bulk ops, dedup scans, progress UI, and artifacts. Use when adding or changing background processing, export downloads, job tray UX, or queued sync recovery. Do NOT use for immediate synchronous REST endpoints (use mms-backend-api), UI module page layout (use mms-module-page), or database schema migrations (use mms-schema-migrate).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Background Jobs Workflow

**Rule (norms SSOT):** `mms-module-architecture.md` §5 · `mms-auth-security.md` · `mms-performance.md` §2 · `mms-api-interface.md` §6.

## When to use

- Adding or changing BullMQ jobs, export downloads, or job-tray UX
- Queued sync recovery or background processing for large batches

Source: `mms-module-architecture.md` §5. Rules: `mms-module-architecture.md`, `mms-auth-security.md`, `mms-performance.md` §2 (Zero Memory Buffering & Streaming Background Workers). Retention hard-purge workflow → **`mms-soft-delete`**.

Use this skill when adding or changing background processing, export/download artifacts, bulk operation progress, job tray UX, or queued sync recovery.

## Financial jobs and retention

Advisory: read [ledger controls](../mms-finance-accounting/references/ledger-controls.md) for import/posting retry identity, payload conflicts, atomic batches and external settlement uncertainty. Bind tenant/user and recheck authority at execution; record progress only after durable commit. A BullMQ job ID alone is not proof of economic idempotency.

For report packs use a cutoff-consistent dataset and retain evidence per [closing and reporting](../mms-finance-accounting/references/closing-reporting.md). Generic retention workers must not treat ledger history, source idempotency evidence, or legal-hold documents as ordinary expired trash; inspect the effective retention policy before scheduling a purge.

## Reference Files

- Backend routes: `apps/backend/src/routes/common/backgroundJobs.ts`
- Worker registry: `apps/backend/src/services/backgroundJobWorkerService.ts`
- Runners: `apps/backend/src/services/backgroundJobRunnerService.ts`
- Artifacts: `apps/backend/src/services/exportArtifactService.ts`
- Frontend API/store: `apps/frontend/src/lib/backgroundJobs/`
- Data transfer SSOT: `packages/shared/src/dataTransfer/` (`createModuleTransferSchema`, `buildExportGrid`, `moduleTransferRegistry`)
- Frontend transfer actions: `apps/frontend/src/lib/backgroundJobs/useModuleCsvImportActions.ts`, `useModuleServerCsvExportActions.ts`
- Generic import dialog: `apps/frontend/src/components/app/ModuleImportDialog.tsx`
- Backend route helpers: `apps/backend/src/lib/registerModuleCsvImportRoutes.ts`, `registerModuleCsvExportRoutes.ts`
- Tray: `apps/frontend/src/components/app/BackgroundJobsTray.tsx`
- Hook: `apps/frontend/src/tenant/hooks/useBackgroundJobs.ts`

## Workflow

1. Decide whether the work is inline or queued. Queue it when it is large, slow, retryable, or needs progress.
2. Add an authenticated tenant route to enqueue the job. Check RBAC before creating the job.
3. Register a runner with a stable `{moduleId}:{kind}` key.
4. Run the job in tenant context and re-apply permission/visibility/soft-delete rules while generating results. Bind tenant + user; propagate trace context via `AsyncLocalStorage` (`AsyncContextFrame`); use explicit resource management (`using` / `await using`) for stream/file handlers; prefer an idempotency key when retries are likely (`mms-api-interface.md` §6).
5. Enqueue the job to **BullMQ** (via Redis 7+) for background execution. Wait for completion via WebSocket or polling.
   - **Headless BiDi Document Engine**: For BiDi documents (Urdu Nastaliq, Arabic, Farsi), use the headless **Typst** compiler with native HarfBuzz text shaping. The pipeline: Fastify API -> BullMQ Queue -> Typst Worker (`.typ` templates) -> Redis PubSub -> S3/MinIO.
   - **Heavy Exports**: Use ExcelJS stream pipes.
   - **Messaging**: Use a dedicated WhatsApp/SMS gateway.
6. Store job state and artifacts scoped by tenant and user (e.g., S3 URLs).
7. Update progress, complete with a clear label, or fail with an actionable reason.
8. Surface status in `BackgroundJobsTray` and provide download/result links only for owned artifacts.
9. Audit sensitive queued work such as export, bulk delete/restore, import, merge, messaging, and sync recovery. Propagate W3C `traceparent` correlation ID into `correlation_id` to link background worker execution with database audit records and APM traces (`mms-audit-trail`).
10. Register background audit verification worker (`runAuditVerificationJob`) to execute scheduled cryptographic hash chain checks and Merkle root rollups.
11. **Scheduled Retention Hard-Purge Worker (`purgeExpiredArchivedRecords`)**:
    - Schedule off-peak (daily at 02:00 UTC) as an isolated worker task (`docs/soft-delete.md` §13) — never run purges inline in HTTP request paths.
    - Chunked lock-free purge loop in bounded batches of 500 rows using `LIMIT 500 FOR UPDATE SKIP LOCKED` with 50ms pauses between batches to prevent WAL spikes and row-lock contention.
    - Emits `entity.hard_purge` audit record inside transaction before physical `DELETE`.
    - Executes `SET LOCAL app.allow_hard_purge = 'true'` inside the worker transaction to bypass the `BEFORE DELETE` trigger.
    - Strictly tenant-scoped (`workspaceSubdomain = tenant`). Supports dry run (`DRY_RUN=true`).

## Job Checklist

```
- [ ] Enqueue route uses authenticateTenant
- [ ] RBAC checked before enqueue
- [ ] Runner key is registered exactly once
- [ ] Tenant context is preserved while executing
- [ ] Stored state/artifact is tenant + user scoped
- [ ] Progress/result/failure are user-visible
- [ ] Download requires current user ownership
- [ ] Export respects field visibility and soft-delete policy
- [ ] Module CSV import/export adheres to @mms/shared data transfer schemas (Field Whitelist, 1:1 header symmetry)
- [ ] Sensitive job is audited
- [ ] W3C traceparent propagated as correlation ID in audit events
- [ ] Scheduled verification runner registered for audit integrity
- [ ] Scheduled retention hard-purge runner registered for expired soft-deleted entities (LIMIT 500 SKIP LOCKED)
- [ ] Datasets exceeding interactive threshold (>500 rows) offloaded to background worker jobs with streaming pipelines
- [ ] Jobs use BullMQ + Redis 7+ for durable queuing
- [ ] Tests cover success, forbidden, and failure paths
```

## Do Not

- Trust client-upserted job records for privileged work.
- Use queued jobs to bypass field, report, export, or soft-delete rules.
- Run hard-purge deletions inline in HTTP request handlers.
- Execute hard purge without SET LOCAL app.allow_hard_purge = 'true' or without emitting entity.hard_purge audit record.
- Execute global cross-tenant hard purge operations.
- Leave failed jobs invisible.
- Store long-lived artifacts without expiry.
- Bypass BullMQ for heavy report generation; do not block Fastify event loop.

## References

- BullMQ Background Job Lifecycle: `references/background-job-lifecycle.md`

## Related skills

`mms-queue-ops`, `mms-backend-api`, `mms-messaging`, `mms-reports-export`.
