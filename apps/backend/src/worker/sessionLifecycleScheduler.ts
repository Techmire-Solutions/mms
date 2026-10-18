import { sql } from 'drizzle-orm';
import { withGlobalTenant } from '../db/tenant-context.js';
import { logger } from '../lib/logger.js';
import { broadcastTenantUpdate } from '../lib/livePush.js';
import { LEADER_LOCK_SESSION_LIFECYCLE, tryAcquireLeaderLease } from '../lib/leaderElection.js';
import { recordModernAuditEvent } from '../services/auditTrailService.js';

/** Hourly so each workspace flips on its own local business day. */
const INTERVAL_MS = 60 * 60 * 1000;
let lifecycleTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Auto-start: `open` sessions whose start date has arrived (workspace timezone) move to
 * `in_progress`, which engages the post-start edit lock. Returns the started session ids.
 */
export async function runSessionAutoStart(): Promise<Array<{ workspace: string; id: string }>> {
  const started = await withGlobalTenant(async (tx) => {
    const result = await tx.execute<{ workspace: string; id: string }>(sql`
      UPDATE sessions s
         SET status = 'in_progress', updated_at = now()
        FROM workspaces w
       WHERE w.subdomain = s.workspace_subdomain
         AND s.status = 'open' AND s.deleted_at IS NULL
         AND s.start_date IS NOT NULL
         AND s.start_date <= (CURRENT_TIMESTAMP AT TIME ZONE COALESCE((SELECT tz.name FROM pg_timezone_names tz WHERE tz.name = w.timezone), 'UTC'))::date
      RETURNING s.workspace_subdomain AS workspace, s.id
    `);
    for (const row of result.rows) {
      await recordModernAuditEvent(tx, { workspaceSubdomain: row.workspace, tableName: 'sessions', recordId: row.id,
        actionType: 'UPDATE', newState: { status: 'in_progress', reason: 'Auto-start on start date' } });
    }
    return result.rows;
  });
  for (const workspace of new Set(started.map((row) => row.workspace))) broadcastTenantUpdate(workspace, 'collection', 'sessions');
  return started;
}

export function clearSessionLifecycleScheduler(): void {
  if (lifecycleTimer !== null) {
    clearTimeout(lifecycleTimer);
    lifecycleTimer = null;
  }
}

/** Runs the auto-start sweep hourly on the replica that holds the leader lease. */
export function scheduleSessionLifecycle(isWorkerRunning: () => boolean, delayMs = 60_000): void {
  if (!isWorkerRunning()) return;
  lifecycleTimer = setTimeout(() => {
    void (async () => {
      const lease = await tryAcquireLeaderLease(LEADER_LOCK_SESSION_LIFECYCLE);
      if (!lease) return;
      try {
        const started = await runSessionAutoStart();
        if (started.length > 0) logger.info({ count: started.length }, '[SessionLifecycle] Auto-started sessions');
      } catch (err) {
        logger.error({ err }, '[SessionLifecycle] Auto-start sweep failed');
      } finally {
        await lease.release();
      }
    })().finally(() => scheduleSessionLifecycle(isWorkerRunning, INTERVAL_MS));
  }, delayMs);
  lifecycleTimer.unref?.();
}
