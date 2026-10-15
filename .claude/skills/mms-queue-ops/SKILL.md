---
name: mms-queue-ops
description: Diagnoses and safely operates the MMS BullMQ worker — stuck, retrying, or failed jobs, queue backlog, and worker restarts. Use when a background export/import, PDF render, messaging broadcast, or settings job never completes, or when the worker process is unhealthy. Do NOT use for authoring new job types and progress UI (use mms-background-jobs), for deploy/rollback mechanics (use mms-incident-response), or for slow database queries (use mms-db-performance).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
compatibility: Requires a reachable Redis instance and the worker process for live queue inspection.
---

# MMS Queue Ops

**Rules (norms SSOT):** `mms-data-layer.md` (queue mechanics, Redis, connections) · `mms-module-architecture.md` §5 (job UX contract, worker isolation). Job authoring workflow → `mms-background-jobs`.

## When to use

- A background export/import, PDF, messaging, or settings job never completes
- The BullMQ worker process is unhealthy and needs safe replay

## Financial replay decisions

Advisory: before replaying billing, collection, payroll, opening/closing, or bank-import jobs, use [ledger controls](../mms-finance-accounting/references/ledger-controls.md) to inspect committed source IDs, journals, allocations and provider outcomes. Retry the same operation identity only after establishing its state; do not mint a new key to bypass a conflict.

An export retry can regenerate an artifact, but its source cutoff may change. A payment timeout can mean the bank accepted it. Reconcile first and report exactly which operation was resumed; do not delete deduplication evidence to clear the queue.

## Topology (verified)

| Piece | Location |
|---|---|
| Worker entry | `apps/backend/src/worker/index.ts` |
| Queues | `apps/backend/src/worker/queues/index.ts` — `QUEUE_PDF_RENDERING`, `QUEUE_BULK_EXPORT`, `QUEUE_MESSAGING_BROADCAST`, `QUEUE_SETTINGS` |
| Connection | `apps/backend/src/lib/redis.ts` (ioredis, `REDIS_URL`), options in `worker/queues/queueConfig.ts` |
| Process | docker-compose `worker` service, PM2 `mmsv2-worker`, dev `pnpm --filter mms-backend worker` |
| Row-claiming jobs | `worker/purgeArchivedRecordsJob.ts`, `worker/processors/outboxCdcProcessor.ts` (`FOR UPDATE SKIP LOCKED`) |

Job state lives in Redis, so the worker scales horizontally and the API process must never execute jobs inline. For Redis query commands and key patterns, see [references/bullmq-redis-cheatsheet.md](references/bullmq-redis-cheatsheet.md).

## Triage order

1. **Is the worker running at all?** A dead worker looks exactly like a stuck job — the queue simply stops draining.
   ```bash
   pm2 status                      # expect mmsv2-worker online
   pm2 logs mmsv2-worker --lines 100
   ```
   Local: `pnpm --filter mms-backend worker` in its own terminal.
2. **Is Redis reachable from the worker?** Connection failures surface as reconnect loops in the worker log.
   ```bash
   redis-cli -u "$REDIS_URL" ping
   ```
3. **Is the queue draining?** Inspect depth and failure counts per queue (`QUEUE_*` names above). A growing `waiting` with an idle worker means the worker is stuck on a dead connection; a growing `failed` means the job itself throws.
4. **Classify the failure from the job payload + log**: tenant context missing (job ran without `withTenant`), a soft-deleted or purged row the job still expects, an external provider timeout (WhatsApp/PDF), or an OOM in the worker heap.
5. **Heap/profile a suspected leak** rather than guessing:
   ```bash
   pnpm --filter mms-backend benchmark:worker
   ```
6. **Replay deliberately.** Re-enqueue only idempotent jobs, and make sure the enqueue carries tenant + user binding and an idempotency key (`mms-module-architecture.md` §5). A bulk export can be re-run; a messaging broadcast usually cannot — check whether the partial send will double-message recipients before replaying.
7. **Restart to clear a wedged worker** (deploy state unchanged): `pm2 reload mmsv2-worker`. If the restart loop continues, treat it as an incident (`mms-incident-response`) — a crash-looping worker can exhaust Redis connections and destabilise the API.

## Verify before calling it fixed

```bash
pm2 status                                   # worker online, restart count stable
pnpm --filter mms-backend typecheck && pnpm --filter mms-backend test
```

Confirm the original job reached a terminal state (`completed` or a deliberate `failed`), the `BackgroundJobsTray` reflects it, and no orphaned rows are left in the outbox or purge tables. If you replayed a job, state explicitly what you re-ran and why it was safe to re-run.

## Do not

- Run job processors inline in the API process to "unblock" a queue.
- Purge a queue to clear a backlog without reading the payloads — queued rows usually correspond to user-visible artifacts and audit events.
- Delete Redis keys by pattern on a shared instance.
- Replay a non-idempotent broadcast without checking what already sent.

## Related skills

`mms-background-jobs` (authoring jobs + progress UI), `mms-incident-response` (server-level outage), `mms-db-performance` (slow job queries), `mms-audit-trail` (outbox/CDC semantics).
