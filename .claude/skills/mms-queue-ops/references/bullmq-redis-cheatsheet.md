# BullMQ & Redis Operations Cheatsheet

Quick operational reference for diagnosing queues, active jobs, and worker health in MMS.

## 1. Queue Identifiers

Declared in `apps/backend/src/worker/queues/index.ts`:

| Queue Constant | Redis Key Prefix | Typical Payload | Idempotent Replay? |
|---|---|---|---|
| `QUEUE_PDF_RENDERING` | `bull:pdf-rendering` | Invoice PDF, Report Card PDF | Yes (replaces artifact) |
| `QUEUE_BULK_EXPORT` | `bull:bulk-export` | CSV/Excel full-collection export | Yes (replaces artifact) |
| `QUEUE_MESSAGING_BROADCAST` | `bull:messaging-broadcast` | SMS / WhatsApp campaign batches | **Caution** (check message logs) |
| `QUEUE_SETTINGS` | `bull:settings-jobs` | Backup export, workspace wipe-restore | Check tenant lock |

## 2. Redis Triage Commands

Connect using `redis-cli`:
```bash
redis-cli -u "$REDIS_URL"
```

### Checking Queue Depths
```bash
# Count waiting jobs
LLEN "bull:bulk-export:wait"

# Count active jobs currently claimed by a worker
LLEN "bull:bulk-export:active"

# Count failed jobs
ZCARD "bull:bulk-export:failed"

# Count completed jobs retained
ZCARD "bull:bulk-export:completed"
```

### Inspecting a Failed Job
```bash
# Get the 5 most recent failed job IDs
ZREVRANGE "bull:bulk-export:failed" 0 4

# View full job payload and failedReason
HGETALL "bull:bulk-export:<job-id>"
```

## 3. Worker Health & Heartbeat

- **Stalled Job Detection:** BullMQ workers renew job locks periodically. If a worker process exits or is killed during a job, BullMQ detects the expired lock (`stalledInterval: 30000`) and moves the job back to `wait` up to `maxStalledCount` times.
- **Worker Crash Loop Diagnostics:**
  ```bash
  pm2 status mmsv2-worker
  pm2 logs mmsv2-worker --lines 200 --err
  ```
- **Restarting Worker:**
  ```bash
  pm2 restart mmsv2-worker
  ```
