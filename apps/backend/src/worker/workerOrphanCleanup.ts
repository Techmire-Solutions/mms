import { and, eq, lt } from "drizzle-orm";
import { withGlobalTenant } from "../db/tenant-context.js";
import { backgroundJobs } from "../db/schema.js";
import { logger } from "../lib/logger.js";

/** A 'pending' job older than this is assumed to have never been dispatched. */
const STALE_PENDING_MS = 10 * 60 * 1000;
/**
 * A 'running' job whose heartbeat is older than this is assumed orphaned.
 * `executeJob` refreshes `updated_at` every minute, so this is ~15 missed
 * heartbeats. Crucially this must NOT fail every running row: with more than
 * one worker replica, startup cleanup would otherwise kill jobs that are
 * actively running on the other replica.
 */
const STALE_RUNNING_MS = 15 * 60 * 1000;

export async function cleanupOrphanedJobs(): Promise<void> {
  try {
    await withGlobalTenant(async (tx) => {
      // Only reclaim running jobs whose heartbeat has gone silent — not jobs
      // that another live worker is still processing.
      const runningCutoff = new Date(Date.now() - STALE_RUNNING_MS);
      const running = await tx
        .update(backgroundJobs)
        .set({
          status: "failed",
          error: "Worker heartbeat lost while job was running",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(eq(backgroundJobs.status, "running"), lt(backgroundJobs.updatedAt, runningCutoff)),
        )
        .returning({ id: backgroundJobs.id });

      if (running.length > 0) {
        logger.info({ count: running.length }, "Cleaned up orphaned running jobs");
      }

      // Jobs stuck in 'pending' for a long time were likely inserted but never
      // dispatched (crash between DB insert and queue.add). Fail them so they
      // do not sit forever.
      const stalePendingCutoff = new Date(Date.now() - STALE_PENDING_MS);
      const pending = await tx
        .update(backgroundJobs)
        .set({
          status: "failed",
          error: "Job was never dispatched to the queue",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(backgroundJobs.status, "pending"),
            lt(backgroundJobs.updatedAt, stalePendingCutoff),
          ),
        )
        .returning({ id: backgroundJobs.id });

      if (pending.length > 0) {
        logger.info({ count: pending.length }, "Cleaned up stale pending jobs");
      }
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to cleanup orphaned jobs");
  }
}
