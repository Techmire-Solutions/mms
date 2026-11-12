import { withTenant } from "../db/tenant-context.js";
import { runWithTenant } from "../lib/tenantContext.js";
import { logger } from "../lib/logger.js";
import { notificationsUseCases } from "../notifications/use-cases/notificationsUseCases.js";
import { fxRevaluationDeps } from "../accounting/use-cases/fxRevaluationDeps.js";
import { ias29Deps } from "../accounting/use-cases/ias29Deps.js";
import { postFxRevaluation } from "../accounting/use-cases/fxRevaluationUseCases.js";
import { postIas29Restatement } from "../accounting/use-cases/ias29UseCases.js";
import { collectOverdueInvoices } from "../finance/use-cases/financeCollectUseCases.js";
import { generateInvoices } from "../finance/use-cases/financeInvoiceGenerationUseCases.js";
import type { FinanceModulePreferences } from "@mms/shared";

/**
 * The individual finance automation steps.
 *
 * Every step calls a use case whose database uniqueness/locks make replay safe:
 * generated invoices are unique per (enrollment, billing period); revaluation and
 * IAS 29 runs are unique per date and serialised by an advisory lock; overdue
 * marking and late fees are guarded in SQL. A sweep can therefore be retried or
 * run twice without double-billing, and the next scheduled tick re-runs it.
 */

export interface AutomationStepResult {
  ran: boolean;
  detail: string;
}

/** `YYYY-MM` of the month before `localDate` (a tenant-local calendar day). */
export function previousBillingPeriod(localDate: string): string {
  const year = Number(localDate.slice(0, 4));
  const month = Number(localDate.slice(5, 7));
  const previous = new Date(Date.UTC(year, month - 2, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** True when `localDate` is the last calendar day of its month. */
export function isLastDayOfMonth(localDate: string): boolean {
  const year = Number(localDate.slice(0, 4));
  const month = Number(localDate.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Number(localDate.slice(8, 10)) === lastDay;
}

/** A domain rejection (422/409) means "this workspace cannot do it now" — skip, do not fail the sweep. */
function isSkippable(error: unknown): boolean {
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  return status === 422 || status === 409;
}

/**
 * Marks overdue invoices and alerts the finance audience in-app.
 *
 * Customer-facing reminders stay a deliberate human action (`remindOpenInvoices`
 * claims the invoice for 24 h so a staff send is not duplicated); this step only
 * moves the status and notifies the workspace, with a per-day dedupe key.
 */
export async function runOverdueMarking(
  tenant: string,
  localDate: string,
  prefs: Pick<FinanceModulePreferences, "overdueReminder" | "feeReminders">,
): Promise<AutomationStepResult> {
  if (!prefs.overdueReminder && !prefs.feeReminders) {
    return { ran: false, detail: "reminders disabled by preferences" };
  }
  const result = await runWithTenant(tenant, () => collectOverdueInvoices({ applyLateFee: false }));
  if (result.markedOverdue > 0) {
    await notificationsUseCases.notify(tenant, {
      kind: "finance_invoices_overdue",
      audiencePermission: "finance.read",
      entityType: "finance_invoices",
      entityId: `overdue-${localDate}`,
      subjectLabel: `${result.markedOverdue} invoices are overdue`,
      contextLabel: `Marked overdue on ${localDate}`,
      dedupeKey: `finance-overdue:${tenant}:${localDate}`,
    });
  }
  return { ran: result.markedOverdue > 0, detail: `${result.markedOverdue} marked overdue` };
}

/**
 * Generates the previous month's invoices on the first local day of the month.
 *
 * Idempotent through the `(enrollment, billing_period)` unique index and the
 * enrollment invoice marks: a second call in the same month creates nothing.
 */
export async function generateDueInvoices(
  tenant: string,
  localDate: string,
  prefs: Pick<FinanceModulePreferences, "autoGenerateInvoice">,
): Promise<AutomationStepResult> {
  if (!prefs.autoGenerateInvoice) {
    return { ran: false, detail: "autoGenerateInvoice disabled" };
  }
  if (Number(localDate.slice(8, 10)) !== 1) {
    return { ran: false, detail: "not the first day of the billing cycle" };
  }
  const billingPeriod = previousBillingPeriod(localDate);
  try {
    const result = await runWithTenant(tenant, () => generateInvoices({ billingPeriod }));
    return {
      ran: result.created > 0,
      detail: `${result.created} created, ${result.skipped} skipped, ${result.unposted} unposted`,
    };
  } catch (error) {
    if (isSkippable(error)) return { ran: false, detail: String((error as Error).message) };
    throw error;
  }
}

/** Posts the period-end revaluation on the last local day of the month (one run per date). */
export async function revalueMonthEnd(
  tenant: string,
  localDate: string,
): Promise<AutomationStepResult> {
  if (!isLastDayOfMonth(localDate)) {
    return { ran: false, detail: "not the last day of the month" };
  }
  try {
    const run = await runWithTenant(tenant, () =>
      postFxRevaluation(fxRevaluationDeps, { tenant, userId: "system" }, localDate),
    );
    return {
      ran: run.lines.length > 0,
      detail: `${run.lines.length} revalued line(s)`,
    };
  } catch (error) {
    // A missing rate or an unset unrealized-FX account is a configuration gap; the
    // next close attempt must surface it, but the nightly sweep must not crash.
    if (isSkippable(error)) {
      logger.warn({ tenant, localDate, err: (error as Error).message }, "FX revaluation skipped");
      return { ran: false, detail: String((error as Error).message) };
    }
    throw error;
  }
}

/** Posts the IAS 29 restatement on the last local day of the month when enabled (one run per date). */
export async function restateMonthEnd(
  tenant: string,
  localDate: string,
): Promise<AutomationStepResult> {
  if (!isLastDayOfMonth(localDate)) {
    return { ran: false, detail: "not the last day of the month" };
  }
  const settings = await withTenant(tenant, () =>
    ias29Deps.store.getHyperinflationSettings(tenant),
  );
  if (!settings.enabled) return { ran: false, detail: "IAS 29 disabled" };
  if (settings.appliesFrom && localDate < settings.appliesFrom) {
    return { ran: false, detail: "before the hyperinflation applies-from date" };
  }
  try {
    const run = await runWithTenant(tenant, () =>
      postIas29Restatement(ias29Deps, { tenant, userId: "system" }, localDate),
    );
    return { ran: true, detail: `${run.lines.length} restated line(s)` };
  } catch (error) {
    if (isSkippable(error)) {
      logger.warn(
        { tenant, localDate, err: (error as Error).message },
        "IAS 29 restatement skipped",
      );
      return { ran: false, detail: String((error as Error).message) };
    }
    throw error;
  }
}
