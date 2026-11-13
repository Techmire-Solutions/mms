import { DEFAULT_FINANCE_SETTINGS, type FinanceModulePreferences } from "@mms/shared";
import { todayInTimeZone } from "../lib/dbDate.js";
import { logger } from "../lib/logger.js";
import { runWithTenant } from "../lib/tenantContext.js";
import { LEADER_LOCK_FINANCE_AUTOMATION, tryAcquireLeaderLease } from "../lib/leaderElection.js";
import { loadFinanceModulePreferences } from "../services/financePreferencesService.js";
import { createJobDeadline, runWithJobDeadline } from "../services/backgroundJobDeadline.js";
import { getWorkspaceTimezone } from "../lib/workspaceTimezone.js";
import { listEnabledWorkspaces, withTimeout } from "./sweepSupport.js";
import {
  generateDueInvoices,
  restateMonthEnd,
  revalueMonthEnd,
  runOverdueMarking,
  type AutomationStepResult,
} from "./financeAutomationRuns.js";

/**
 * Scheduled finance automation (leader-only sweep).
 *
 * Why a sweep and not a BullMQ job: scheduled work has no tenant user to
 * attribute, and `background_jobs.user_id` is FK-constrained to `tenant_users`,
 * so enqueuing system jobs would either misattribute the audit actor or require a
 * fake user row. The steps call idempotent use cases (unique invoice period
 * indexes, unique run-per-date rows plus advisory locks), so the next hourly tick
 * is the retry — no queue, no DLQ, no duplicate billing. Each step still runs
 * under the shared `createJobDeadline` contract, so process shutdown aborts it.
 *
 * The sweep is gated three ways:
 *  - `FINANCE_AUTOMATION_ENABLED=true` (default off — shipping must not silently
 *    start billing every tenant),
 *  - the tenant's finance preferences (`autoGenerateInvoice`, reminder flags),
 *  - the tenant-local calendar (first day for billing, last day for revaluation
 *    and IAS 29).
 */
const INTERVAL_MS = 60 * 60 * 1000;
/** One workspace should never take longer than this; a hung tenant is deferred. */
export const WORKSPACE_TIMEOUT_MS = 5 * 60_000;
/** Whole-sweep budget; remaining workspaces are deferred to the next tick. */
export const SWEEP_BUDGET_MS = 45 * 60_000;
/** Local hour that runs month-start billing and month-end revaluation/IAS 29. */
const BOUNDARY_HOUR = 1;
/** Local hour that marks invoices overdue and alerts the finance audience. */
const OVERDUE_HOUR = 6;

let timer: ReturnType<typeof setTimeout> | null = null;

export function isFinanceAutomationEnabled(): boolean {
  return process.env.FINANCE_AUTOMATION_ENABLED === "true";
}

export interface FinanceAutomationFailure {
  workspace: string;
  reason: string;
}

export interface FinanceAutomationSummary {
  workspaces: number;
  scanned: number;
  overdueMarked: number;
  invoicesCreated: number;
  revaluations: number;
  restatements: number;
  failed: FinanceAutomationFailure[];
  deferred: number;
  durationMs: number;
}

interface WorkspaceResult {
  overdueMarked: number;
  invoicesCreated: number;
  revaluations: number;
  restatements: number;
}

/** Hour of day (0-23) in an IANA timezone; unknown zones fall back to UTC. */
export function hourInTimeZone(timeZone: string, now: Date): number {
  try {
    return Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: timeZone || "UTC",
        hour: "2-digit",
        hour12: false,
      }).format(now),
    );
  } catch {
    return now.getUTCHours();
  }
}

/** Loads the tenant's effective preferences inside its request-tenant scope. */
async function loadPreferences(tenant: string): Promise<FinanceModulePreferences> {
  const loaded = await runWithTenant(tenant, () => loadFinanceModulePreferences());
  return { ...DEFAULT_FINANCE_SETTINGS, ...(loaded ?? {}) };
}

/** Runs one step under the shared deadline (per-kind budget + shutdown signal). */
async function step(kind: string, work: () => Promise<AutomationStepResult>) {
  const deadline = createJobDeadline("finance", kind);
  try {
    return await runWithJobDeadline(deadline, work);
  } finally {
    deadline.dispose();
  }
}

/** Runs the due steps for one workspace; exported for tests. */
export async function runWorkspaceAutomation(
  tenant: string,
  now: Date,
  shouldContinue: () => boolean = () => true,
): Promise<WorkspaceResult> {
  const result: WorkspaceResult = {
    overdueMarked: 0,
    invoicesCreated: 0,
    revaluations: 0,
    restatements: 0,
  };
  const timeZone = await getWorkspaceTimezone(tenant);
  const localDate = todayInTimeZone(timeZone, now);
  const localHour = hourInTimeZone(timeZone, now);
  const prefs = await loadPreferences(tenant);

  if (localHour === OVERDUE_HOUR && shouldContinue()) {
    const overdue = await step("automation-overdue", () =>
      runOverdueMarking(tenant, localDate, prefs),
    );
    if (overdue.ran) result.overdueMarked += 1;
    logger.info({ tenant, localDate, ...overdue }, "[FinanceAutomation] Overdue step");
  }

  if (localHour === BOUNDARY_HOUR && shouldContinue()) {
    const billing = await step("automation-generate", () =>
      generateDueInvoices(tenant, localDate, prefs),
    );
    if (billing.ran) result.invoicesCreated += 1;
    if (billing.detail)
      logger.info({ tenant, localDate, ...billing }, "[FinanceAutomation] Billing step");

    const revaluation = await step("automation-revalue", () => revalueMonthEnd(tenant, localDate));
    if (revaluation.ran) result.revaluations += 1;
    if (revaluation.detail)
      logger.info({ tenant, localDate, ...revaluation }, "[FinanceAutomation] Revaluation step");

    const restatement = await step("automation-ias29", () => restateMonthEnd(tenant, localDate));
    if (restatement.ran) result.restatements += 1;
    if (restatement.detail)
      logger.info({ tenant, localDate, ...restatement }, "[FinanceAutomation] IAS 29 step");
  }

  return result;
}

/**
 * Runs the automation for every enabled workspace. Exported for tests, which pass
 * an explicit workspace list/clock; production enters through
 * `scheduleFinanceAutomation`.
 */
export async function runFinanceAutomationSweep(
  options: {
    workspaces?: readonly string[];
    now?: Date;
    enabled?: boolean;
    shouldContinue?: () => boolean;
  } = {},
): Promise<FinanceAutomationSummary> {
  const startedAt = Date.now();
  const summary: FinanceAutomationSummary = {
    workspaces: 0,
    scanned: 0,
    overdueMarked: 0,
    invoicesCreated: 0,
    revaluations: 0,
    restatements: 0,
    failed: [],
    deferred: 0,
    durationMs: 0,
  };
  const enabled = options.enabled ?? isFinanceAutomationEnabled();
  if (!enabled) return summary;

  const now = options.now ?? new Date();
  const shouldContinue = options.shouldContinue ?? (() => true);
  const workspaces = options.workspaces ?? (await listEnabledWorkspaces());
  summary.workspaces = workspaces.length;

  for (const [index, workspace] of workspaces.entries()) {
    if (Date.now() - startedAt > SWEEP_BUDGET_MS || !shouldContinue()) {
      summary.deferred = workspaces.length - index;
      logger.warn(
        { deferred: summary.deferred, elapsedMs: Date.now() - startedAt },
        "[FinanceAutomation] Sweep budget/shutdown reached; deferring remaining workspaces",
      );
      break;
    }
    try {
      const result = await withTimeout(
        runWorkspaceAutomation(workspace, now, shouldContinue),
        WORKSPACE_TIMEOUT_MS,
        `finance automation ${workspace}`,
      );
      summary.scanned += 1;
      summary.overdueMarked += result.overdueMarked;
      summary.invoicesCreated += result.invoicesCreated;
      summary.revaluations += result.revaluations;
      summary.restatements += result.restatements;
    } catch (error) {
      // One tenant's configuration must never stop the sweep for the rest — but it
      // must be visible in the summary and the log.
      const reason = error instanceof Error ? error.message : String(error);
      summary.failed.push({ workspace, reason });
      logger.error({ err: error, workspace }, "[FinanceAutomation] Workspace sweep failed");
    }
  }

  summary.durationMs = Date.now() - startedAt;
  return summary;
}

export function clearFinanceAutomationScheduler(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

/** Leader-only hourly tick; reschedules itself after every run. */
export function scheduleFinanceAutomation(
  isWorkerRunning: () => boolean,
  delayMs = 5 * 60_000,
): void {
  if (!isWorkerRunning() || !isFinanceAutomationEnabled()) return;
  timer = setTimeout(() => {
    void (async () => {
      let lease: Awaited<ReturnType<typeof tryAcquireLeaderLease>> = null;
      try {
        lease = await tryAcquireLeaderLease(LEADER_LOCK_FINANCE_AUTOMATION);
        if (!lease) return;
        const summary = await runFinanceAutomationSweep({ shouldContinue: isWorkerRunning });
        logger.info(summary, "[FinanceAutomation] Sweep finished");
      } catch (err) {
        logger.error({ err }, "[FinanceAutomation] Sweep failed");
      } finally {
        // The lease is a session lock on a pooled connection: holding it would block
        // every other worker's sweep.
        await lease?.release().catch((err: unknown) => {
          logger.error({ err }, "[FinanceAutomation] Failed to release the leader lease");
        });
      }
    })()
      .catch((err: unknown) => {
        logger.error({ err }, "[FinanceAutomation] Failed to acquire leader lease");
      })
      .finally(() => scheduleFinanceAutomation(isWorkerRunning, INTERVAL_MS));
  }, delayMs);
  timer.unref?.();
}
