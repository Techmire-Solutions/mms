import { sql } from "drizzle-orm";
import { withGlobalTenant, withTenant } from "../db/tenant-context.js";
import { logger } from "../lib/logger.js";
import { LEADER_LOCK_ATTENDANCE_ABSENCE, tryAcquireLeaderLease } from "../lib/leaderElection.js";
import { scanAbsenceStreaks } from "../attendance/use-cases/attendanceEscalationUseCases.js";

/**
 * Hourly chronic-absence sweep (leader-only).
 *
 * Two hard-won rules live here:
 * 1. **A hung workspace must not wedge the sweep.** The leader lease is a session advisory lock held
 *    by a checked-out pool connection; a query that never returns would hold it forever *and* stop the
 *    timer being rescheduled. Each workspace therefore runs under `statement_timeout` plus a wall-clock
 *    deadline, and the sweep always settles.
 * 2. **Failures must be countable.** A per-workspace failure is logged and counted, then reported in
 *    the sweep summary — silently skipping a tenant was indistinguishable from a clean run.
 *
 * The on-demand scan is a BullMQ job (`attendance:absence-scan`); this file is only the schedule.
 */
const INTERVAL_MS = 60 * 60 * 1000;
/** One workspace should never take longer than this; 30s of it is the DB statement budget. */
const WORKSPACE_TIMEOUT_MS = 60_000;
const STATEMENT_TIMEOUT_MS = 30_000;
/** Whole-sweep budget: beyond this the remaining workspaces are deferred to the next tick. */
const SWEEP_BUDGET_MS = 45 * 60_000;
let absenceTimer: ReturnType<typeof setTimeout> | null = null;

export interface AbsenceSweepFailure {
  workspace: string;
  reason: string;
}

export interface AbsenceSweepSummary {
  workspaces: number;
  scanned: number;
  failed: AbsenceSweepFailure[];
  alertsRaised: number;
  alertsUpdated: number;
  notificationsCapped: number;
  durationMs: number;
  /** True when the sweep budget stopped the run before every workspace was visited. */
  deferred: number;
}

/** Enabled workspaces, for the leader-only sweep. */
export async function listEnabledWorkspaces(): Promise<string[]> {
  const result = await withGlobalTenant(async (tx) =>
    tx.execute<{ subdomain: string }>(sql`
      SELECT subdomain FROM workspaces WHERE enabled = true ORDER BY subdomain
    `),
  );
  return (result.rows ?? []).map((row) => String(row.subdomain));
}

/** Rejects when `promise` does not settle within `ms`; the timer is always cleared. */
export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Scans one workspace with a DB-level statement budget.
 *
 * The `SET LOCAL statement_timeout` runs inside the outer transaction, so every nested read of the
 * scan inherits it; a stuck query aborts, the connection goes back to the pool and the advisory lock
 * is released.
 */
async function scanWorkspace(workspace: string) {
  return withTenant(
    workspace,
    async (tx) => {
      await tx.execute(sql.raw(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`));
      return scanAbsenceStreaks(workspace);
    },
    { readOnly: false },
  );
}

/**
 * Per-workspace loop, with the scanner injected so the stall/budget behaviour is testable.
 *
 * Exported for tests only; production enters through {@link runAttendanceAbsenceScan}.
 */
export async function runWorkspaceSweeps(
  workspaces: readonly string[],
  scanOne: (workspace: string) => Promise<{
    alertsRaised: number;
    alertsUpdated: number;
    notificationsCapped: boolean;
  }>,
  options: {
    workspaceTimeoutMs?: number;
    sweepBudgetMs?: number;
    now?: () => number;
  } = {},
): Promise<AbsenceSweepSummary> {
  const workspaceTimeoutMs = options.workspaceTimeoutMs ?? WORKSPACE_TIMEOUT_MS;
  const sweepBudgetMs = options.sweepBudgetMs ?? SWEEP_BUDGET_MS;
  const now = options.now ?? Date.now;
  const startedAt = now();
  const summary: AbsenceSweepSummary = {
    workspaces: workspaces.length,
    scanned: 0,
    failed: [],
    alertsRaised: 0,
    alertsUpdated: 0,
    notificationsCapped: 0,
    durationMs: 0,
    deferred: 0,
  };

  for (const [index, workspace] of workspaces.entries()) {
    const elapsed = now() - startedAt;
    if (elapsed > sweepBudgetMs) {
      summary.deferred = workspaces.length - index;
      logger.warn(
        { workspace, deferred: summary.deferred, elapsedMs: elapsed },
        "[AttendanceAbsence] Sweep budget exhausted; deferring remaining workspaces",
      );
      break;
    }
    try {
      const scan = await withTimeout(scanOne(workspace), workspaceTimeoutMs, `scan ${workspace}`);
      summary.scanned += 1;
      summary.alertsRaised += scan.alertsRaised;
      summary.alertsUpdated += scan.alertsUpdated;
      if (scan.notificationsCapped) summary.notificationsCapped += 1;
    } catch (error) {
      // One tenant's data must never stop the sweep for the rest — but it must be visible.
      const reason = error instanceof Error ? error.message : String(error);
      summary.failed.push({ workspace, reason });
      logger.error({ err: error, workspace }, "[AttendanceAbsence] Scan failed for workspace");
    }
  }

  summary.durationMs = now() - startedAt;
  return summary;
}

/** Runs the scan for every workspace; returns a summary suitable for logging/alerting. */
export async function runAttendanceAbsenceScan(): Promise<AbsenceSweepSummary> {
  const workspaces = await listEnabledWorkspaces();
  const summary = await runWorkspaceSweeps(workspaces, scanWorkspace);
  logger.info(summary, "[AttendanceAbsence] Sweep finished");
  return summary;
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
      let lease: Awaited<ReturnType<typeof tryAcquireLeaderLease>> = null;
      try {
        lease = await tryAcquireLeaderLease(LEADER_LOCK_ATTENDANCE_ABSENCE);
        if (!lease) return;
        await runAttendanceAbsenceScan();
      } catch (err) {
        logger.error({ err }, "[AttendanceAbsence] Sweep failed");
      } finally {
        // Always release, even on the deadline path: the lease is a session lock on a pooled
        // connection, and holding it would block every other worker's sweep.
        await lease?.release().catch((err: unknown) => {
          logger.error({ err }, "[AttendanceAbsence] Failed to release the leader lease");
        });
      }
    })()
      .catch((err: unknown) => {
        logger.error({ err }, "[AttendanceAbsence] Failed to acquire leader lease");
      })
      .finally(() => scheduleAttendanceAbsence(isWorkerRunning, INTERVAL_MS));
  }, delayMs);
  absenceTimer.unref?.();
}
