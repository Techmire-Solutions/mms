import { workspaces } from "../db/schema.js";
import { activeDb, type DbClient } from "../db/dbConnection.js";
import { logger } from "../lib/logger.js";
import { LEADER_LOCK_RETENTION_PURGE, tryAcquireLeaderLease } from "../lib/leaderElection.js";
import { purgeExpiredArchivedRecords } from "./purgeArchivedRecordsJob.js";
import { purgeExpiredPlatformActivityLogs } from "./purgePlatformActivityLogsJob.js";
import { runAttachmentSweep } from "../services/attachmentSweepService.js";
import { settleInFlight, throwIfBackgroundJobAborted } from "../lib/backgroundJobAbort.js";

/** NodeJS timer handle for the daily retention purge scheduler — cleared on shutdown. */
let purgeSchedulerTimer: ReturnType<typeof setTimeout> | null = null;
/** Aborts the in-flight cycle on shutdown so the sweep can stop unlinking. */
let retentionAbortController = new AbortController();
let inFlightRetentionCycle: Promise<unknown> | null = null;
/** Shutdown settle budget for the in-flight cycle (the sweep checks its signal every 25 files). */
const RETENTION_DRAIN_MS = 5_000;

export function clearRetentionPurgeScheduler(): void {
  if (purgeSchedulerTimer !== null) {
    clearTimeout(purgeSchedulerTimer);
    purgeSchedulerTimer = null;
  }
}

/**
 * Stops a running retention cycle and waits (bounded) for it to unwind before the worker closes the
 * DB/Redis pools. Without this the sweep kept unlinking while shutdown tore down its connection.
 */
export async function abortAndDrainRetentionCycle(timeoutMs = RETENTION_DRAIN_MS): Promise<void> {
  retentionAbortController.abort(new Error("Worker is shutting down"));
  if (inFlightRetentionCycle) await settleInFlight(inFlightRetentionCycle, timeoutMs);
}

/**
 * Computes millisecond delay until the next specified UTC hour (default: 02:00 UTC).
 */
export function getMsUntilNextUtcHour(targetUtcHour = 2): number {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(targetUtcHour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime() - now.getTime();
}

/**
 * Runs a full retention purge cycle across all active tenant workspaces,
 * then purges expired apex platform activity logs.
 */
export async function runRetentionPurgeCycle(
  dbClient: DbClient = activeDb(),
  signal?: AbortSignal,
): Promise<Record<string, Record<string, number>>> {
  const results: Record<string, Record<string, number>> = {};
  try {
    const tenants = await dbClient.select({ subdomain: workspaces.subdomain }).from(workspaces);

    for (const { subdomain } of tenants) {
      throwIfBackgroundJobAborted(signal);
      try {
        const res = await purgeExpiredArchivedRecords(dbClient, subdomain);
        results[subdomain] = res.purgedTables;
      } catch (tenantErr) {
        logger.error({ tenant: subdomain, err: tenantErr }, "[RetentionPurge] Failed for tenant");
      }
    }

    try {
      const platformPurge = await purgeExpiredPlatformActivityLogs();
      results.__platform_activity_logs = {
        deleted: platformPurge.deleted,
        retentionDays: platformPurge.retentionDays,
      };
    } catch (platformErr) {
      logger.error({ err: platformErr }, "[RetentionPurge] Failed platform activity log purge");
    }

    if (process.env.MMS_ORPHAN_ATTACHMENT_SWEEP !== "off") {
      try {
        // `DRY_RUN=true` must never delete: report orphan candidates only.
        const applySweep = process.env.DRY_RUN !== "true";
        const { orphanFiles: _orphanFiles, ...sweep } = await runAttachmentSweep({
          apply: applySweep,
          signal,
        });
        results.__orphaned_attachments = {
          scanned: sweep.scanned,
          referencedKeys: sweep.referencedKeys,
          orphans: sweep.orphans,
          deleted: sweep.deleted,
        };
        logger.info(
          { ...sweep, apply: applySweep },
          "[RetentionPurge] Attachment orphan sweep completed",
        );
      } catch (sweepErr) {
        logger.error({ err: sweepErr }, "[RetentionPurge] Attachment orphan sweep failed");
      }
    }

    logger.info({ results }, "[RetentionPurge] Completed scheduled daily purge cycle");
  } catch (err) {
    // Shutdown must stop the cycle, not be swallowed as a generic failure.
    if (err instanceof Error && err.name === "AbortError") throw err;
    logger.error({ err }, "[RetentionPurge] Error running scheduled retention purge cycle");
  }
  return results;
}

/**
 * Schedules the retention purge worker to run daily at 02:00 UTC.
 */
export function scheduleNextDailyPurge(
  isWorkerRunning: () => boolean,
  dbClient: DbClient = activeDb(),
  targetUtcHour = 2,
): void {
  if (!isWorkerRunning()) return;
  const delayMs = getMsUntilNextUtcHour(targetUtcHour);
  logger.info({ delayMs, targetUtcHour }, "[RetentionPurge] Scheduled next daily purge run");

  purgeSchedulerTimer = setTimeout(() => {
    void (async () => {
      const lease = await tryAcquireLeaderLease(LEADER_LOCK_RETENTION_PURGE);
      if (!lease) {
        logger.info("[RetentionPurge] Another replica holds the purge lease; skipping this run");
        return;
      }
      retentionAbortController = new AbortController();
      const cycle = runRetentionPurgeCycle(dbClient, retentionAbortController.signal);
      inFlightRetentionCycle = cycle;
      try {
        await cycle;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          logger.info("[RetentionPurge] Cycle aborted for shutdown");
        } else {
          logger.error({ err }, "[RetentionPurge] Error during scheduled purge run");
        }
      } finally {
        inFlightRetentionCycle = null;
        await lease.release();
      }
    })()
      .catch((err: unknown) => {
        logger.error({ err }, "[RetentionPurge] Failed to acquire leader lease");
      })
      .finally(() => {
        scheduleNextDailyPurge(isWorkerRunning, dbClient, targetUtcHour);
      });
  }, delayMs);
  purgeSchedulerTimer.unref?.();
}
