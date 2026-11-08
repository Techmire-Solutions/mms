import { sql } from "drizzle-orm";
import { withGlobalTenant } from "../db/tenant-context.js";
import { logger } from "../lib/logger.js";
import { LEADER_LOCK_ATTENDANCE_ABSENCE, tryAcquireLeaderLease } from "../lib/leaderElection.js";
import { scanAbsenceStreaks } from "../attendance/use-cases/attendanceEscalationUseCases.js";

/** Hourly: every workspace's chronic-absence streaks are recomputed on its own business day. */
const INTERVAL_MS = 60 * 60 * 1000;
let absenceTimer: ReturnType<typeof setTimeout> | null = null;

/** Enabled workspaces, for the leader-only sweep. */
export async function listEnabledWorkspaces(): Promise<string[]> {
  const result = await withGlobalTenant(async (tx) =>
    tx.execute<{ subdomain: string }>(sql`
      SELECT subdomain FROM workspaces WHERE enabled = true ORDER BY subdomain
    `),
  );
  return (result.rows ?? []).map((row) => String(row.subdomain));
}

/** Runs the scan for every workspace; returns the per-workspace alert counts. */
export async function runAttendanceAbsenceScan(): Promise<
  Array<{ workspace: string; alertsRaised: number; alertsUpdated: number }>
> {
  const workspaces = await listEnabledWorkspaces();
  const results: Array<{ workspace: string; alertsRaised: number; alertsUpdated: number }> = [];
  for (const workspace of workspaces) {
    try {
      const scan = await scanAbsenceStreaks(workspace);
      if (scan.alertsRaised > 0 || scan.alertsUpdated > 0) {
        results.push({
          workspace,
          alertsRaised: scan.alertsRaised,
          alertsUpdated: scan.alertsUpdated,
        });
      }
    } catch (error) {
      // One tenant's data must never stop the sweep for the rest.
      logger.error({ err: error, workspace }, "[AttendanceAbsence] Scan failed for workspace");
    }
  }
  return results;
}

export function clearAttendanceAbsenceScheduler(): void {
  if (absenceTimer !== null) {
    clearTimeout(absenceTimer);
    absenceTimer = null;
  }
}

/** Leader-only hourly sweep; the scan itself is idempotent per streak. */
export function scheduleAttendanceAbsence(
  isWorkerRunning: () => boolean,
  delayMs = 5 * 60_000,
): void {
  if (!isWorkerRunning()) return;
  absenceTimer = setTimeout(() => {
    void (async () => {
      const lease = await tryAcquireLeaderLease(LEADER_LOCK_ATTENDANCE_ABSENCE);
      if (!lease) return;
      try {
        const results = await runAttendanceAbsenceScan();
        const raised = results.reduce((sum, row) => sum + row.alertsRaised, 0);
        if (raised > 0) {
          logger.info({ raised, workspaces: results.length }, "[AttendanceAbsence] Alerts raised");
        }
      } catch (err) {
        logger.error({ err }, "[AttendanceAbsence] Sweep failed");
      } finally {
        await lease.release();
      }
    })()
      .catch((err: unknown) => {
        logger.error({ err }, "[AttendanceAbsence] Failed to acquire leader lease");
      })
      .finally(() => scheduleAttendanceAbsence(isWorkerRunning, INTERVAL_MS));
  }, delayMs);
  absenceTimer.unref?.();
}
