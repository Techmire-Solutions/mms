import { logger } from "../lib/logger.js";
import {
  countPlatformActivityLogsOlderThan,
  deletePlatformActivityLogsOlderThan,
} from "../db/repositories/platformActivityLogsRepository.js";

export const DEFAULT_PLATFORM_ACTIVITY_LOG_RETENTION_DAYS = 180;
const CHUNK_SIZE = 500;
const INTER_CHUNK_PAUSE_MS = 50;

/** Resolve retention window from env or the 180-day default. */
export function resolvePlatformActivityLogRetentionDays(
  envValue = process.env.PLATFORM_ACTIVITY_LOG_RETENTION_DAYS,
): number {
  if (envValue === undefined || envValue.trim() === "") {
    return DEFAULT_PLATFORM_ACTIVITY_LOG_RETENTION_DAYS;
  }
  const parsed = Number.parseInt(envValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_PLATFORM_ACTIVITY_LOG_RETENTION_DAYS;
  }
  return Math.min(parsed, 3650);
}

export function platformActivityLogCutoff(
  now = new Date(),
  retentionDays = resolvePlatformActivityLogRetentionDays(),
): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

/**
 * Purges apex `platform_activity_logs` older than the retention window in
 * bounded chunks (500 rows, 50ms pause). Honors `DRY_RUN=true` (count only).
 */
export async function purgeExpiredPlatformActivityLogs(
  dryRun = process.env.DRY_RUN === "true",
): Promise<{ deleted: number; dryRun: boolean; retentionDays: number }> {
  const retentionDays = resolvePlatformActivityLogRetentionDays();
  const cutoff = platformActivityLogCutoff(new Date(), retentionDays);

  if (dryRun) {
    const count = await countPlatformActivityLogsOlderThan(cutoff);
    logger.info(
      { count, cutoff: cutoff.toISOString(), retentionDays },
      "[PlatformActivityPurge] Dry-run count of expired rows",
    );
    return { deleted: count, dryRun: true, retentionDays };
  }

  let deleted = 0;
  for (;;) {
    const chunk = await deletePlatformActivityLogsOlderThan(cutoff, CHUNK_SIZE);
    deleted += chunk;
    if (chunk < CHUNK_SIZE) break;
    await new Promise((resolve) => setTimeout(resolve, INTER_CHUNK_PAUSE_MS));
  }

  logger.info(
    { deleted, cutoff: cutoff.toISOString(), retentionDays },
    "[PlatformActivityPurge] Completed platform activity log purge",
  );
  return { deleted, dryRun: false, retentionDays };
}
