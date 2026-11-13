import { logger } from "../lib/logger.js";
import { createJobDeadline, runWithJobDeadline } from "../services/backgroundJobDeadline.js";
import {
  isAbortLike,
  recordAutomationFailure,
  type AccountingAutomationKind,
  type AutomationStepResult,
} from "./financeAutomationRuns.js";

/**
 * Step runners for the finance automation sweep.
 *
 * Kept apart from the scheduler so the scheduling policy (which day/hour, which
 * tenant) stays readable: these three functions own the deadline/abort contract
 * and the accounting failure record.
 */

/**
 * Runs one step under the shared deadline (per-kind budget + shutdown signal) and
 * hands the abort signal to the step so an interrupted posting rolls back instead
 * of continuing to write after the deadline rejected.
 */
async function step(
  kind: string,
  work: (signal: AbortSignal) => Promise<AutomationStepResult>,
  signal?: AbortSignal,
): Promise<AutomationStepResult> {
  const deadline = createJobDeadline("finance", kind, signal);
  try {
    return await runWithJobDeadline(deadline, () => work(deadline.signal));
  } finally {
    deadline.dispose();
  }
}

/**
 * Accounting steps are isolated: one failure must neither skip the remaining steps
 * nor disappear into a log line. Real failures are recorded durably (audit +
 * notification) and the next hourly tick on the same local date retries; aborts are
 * rethrown so the sweep can defer the workspace.
 */
async function accountingStep(
  tenant: string,
  localDate: string,
  kind: AccountingAutomationKind,
  work: (signal: AbortSignal) => Promise<AutomationStepResult>,
  shouldContinue: () => boolean,
  signal?: AbortSignal,
): Promise<AutomationStepResult | null> {
  if (!shouldContinue()) return null;
  try {
    return await step(kind, work, signal);
  } catch (error) {
    if (isAbortLike(error)) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    logger.error(
      { tenant, localDate, kind, err: error },
      "[FinanceAutomation] Accounting step failed; recording it",
    );
    await recordAutomationFailure(tenant, localDate, kind, reason);
    return null;
  }
}

/** Finance steps (billing/overdue) are isolated too, but their failures stay in the summary/log. */
async function financeStep(
  kind: string,
  work: (signal: AbortSignal) => Promise<AutomationStepResult>,
  signal?: AbortSignal,
): Promise<AutomationStepResult | null> {
  try {
    return await step(kind, work, signal);
  } catch (error) {
    if (isAbortLike(error)) throw error;
    logger.error({ kind, err: error }, "[FinanceAutomation] Finance step failed");
    return null;
  }
}

export { accountingStep, financeStep, step };
