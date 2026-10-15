# MMS Background Job Lifecycle & Worker Architecture

This guide details BullMQ job processing, single-leader lease scheduling, progress reporting, and artifact generation in MMS.

---

## 1. BullMQ Topology & Worker Process

Long-running asynchronous tasks (PDF generation, Excel exports, bulk messaging, data imports, and nightly retention purges) execute in a dedicated worker process outside Fastify HTTP request threads.

- **Worker Entry Point:** `apps/backend/src/worker/index.ts`
- **Redis Queue Configuration:** `apps/backend/src/worker/queues/`
- **Processors Directory:** `apps/backend/src/worker/processors/`

```
Fastify Route Handler                  Redis (BullMQ)                Worker Process
        │                                    │                              │
        │── queue.add("pdf-render", data) ──►│                              │
        │                                    │── pops job ─────────────────►│
        │                                    │                              │ (processes job)
        │                                    │◄── job.updateProgress(50) ───│
        │                                    │                              │
        │                                    │◄── job completed (artifact) ─│
```

---

## 2. Job Definition & Progress Emission

Processors in `apps/backend/src/worker/processors/` implement idempotent execution:

```typescript
import { Job } from 'bullmq';
import { withTenant } from '@/lib/tenantContext';

export async function processExcelExport(job: Job) {
  const { workspaceId, entity, filters } = job.data;

  return await withTenant(workspaceId, async () => {
    await job.updateProgress(10);

    // Fetch batches
    const records = await fetchExportBatch(filters);
    await job.updateProgress(50);

    // Generate spreadsheet artifact
    const artifact = await buildWorkbook(records);
    await job.updateProgress(90);

    const artifactUrl = await saveJobArtifact(job.id, artifact);
    return { downloadUrl: artifactUrl, totalRows: records.length };
  });
}
```

---

## 3. Scheduled Retention Purge & Single-Leader Leases

- **Scheduler:** `apps/backend/src/worker/retentionPurgeScheduler.ts`
- **Nightly Purge Job:** `apps/backend/src/worker/purgeArchivedRecordsJob.ts`
- **Execution:** Runs daily at 02:00 UTC using a Redis-backed distributed lock (`single-leader lease`) to ensure only one cluster replica executes the purge.
- **Batch Processing:** Soft-deleted records past their retention window are hard-purged in 500-row chunks using `FOR UPDATE SKIP LOCKED` with a 50ms pause between chunks to prevent database lock escalation.

---

## 4. Troubleshooting & Operations

- **Queue Inspection:** Check Redis keys matching `bull:mms-jobs:*`.
- **Worker Recovery:** If worker nodes exit unexpectedly, orphaned jobs are recovered via `apps/backend/src/worker/workerOrphanCleanup.ts`.
- **Related Skill:** `mms-queue-ops` for live BullMQ triage commands and dead-letter analysis.
