import { workspaces } from "../db/schema.js";
import { activeDb, type DbClient } from "../db/dbConnection.js";
import { logger } from "../lib/logger.js";
import { LEADER_LOCK_RETENTION_PURGE, tryAcquireLeaderLease } from "../lib/leaderElection.js";
import { purgeExpiredArchivedRecords } from "./purgeArchivedRecordsJob.js";
import { purgeExpiredPlatformActivityLogs } from "./purgePlatformActivityLogsJob.js";

/** NodeJS timer handle for the daily retention purge scheduler — cleared on shutdown. */
let purgeSchedulerTimer: ReturnType<typeof setTimeout> | null = null;

export function clearRetentionPurgeScheduler(): void {
  if (purgeSchedulerTimer !== null) {
    clearTimeout(purgeSchedulerTimer);
    purgeSchedulerTimer = null;
  }
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
): Promise<Record<string, Record<string, number>>> {
  const results: Record<string, Record<string, number>> = {};
  try {
    const tenants = await dbClient.select({ subdomain: workspaces.subdomain }).from(workspaces);

    for (const { subdomain } of tenants) {
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

    logger.info({ results }, "[RetentionPurge] Completed scheduled daily purge cycle");
  } catch (err) {
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
      try {
        await runRetentionPurgeCycle(dbClient);
      } catch (err) {
        logger.error({ err }, "[RetentionPurge] Error during scheduled purge run");
      } finally {
        await lease.release();
      }
    })().finally(() => {
      scheduleNextDailyPurge(isWorkerRunning, dbClient, targetUtcHour);
    });
  }, delayMs);
  purgeSchedulerTimer.unref?.();
}
