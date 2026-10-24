import { withdrawalInvoicePlan, type WithdrawalBillingOutcome } from "@mms/shared";
import { financeRepository as repo } from "../repository/financeRepositoryAdapter.js";
import { requireTenant } from "../../lib/tenantContext.js";
import { logger } from "../../lib/logger.js";
import { cancelInvoice } from "./financeCollectUseCases.js";

const ref = (invoice: { id: string; invoiceNumber?: string | null }) => ({
  id: invoice.id,
  invoiceNumber: invoice.invoiceNumber ?? null,
});

/**
 * Finance side of an enrollment withdrawal: untouched invoices for billing periods after the last
 * day are cancelled through the regular cancel action (ledger reversal included); paid, part-paid
 * or credited ones are returned for a staff refund decision and never changed here.
 * Each cancellation is independent — one that fails is reported for review instead.
 */
export async function settleEnrollmentWithdrawal(
  enrollmentId: string,
  lastDay: string,
): Promise<WithdrawalBillingOutcome> {
  const tenant = requireTenant();
  const ids = await repo.findInvoiceIdsByEnrollment(tenant, enrollmentId);
  const invoices = ids.length > 0 ? await repo.findInvoicesByIds(tenant, ids) : [];
  const plan = withdrawalInvoicePlan(invoices, lastDay);
  const cancelled: WithdrawalBillingOutcome["cancelled"] = [];
  const review: WithdrawalBillingOutcome["review"] = plan.review.map(ref);
  for (const invoice of plan.cancel) {
    try {
      await cancelInvoice(invoice.id);
      cancelled.push(ref(invoice));
    } catch (error) {
      logger.warn({ err: error, invoiceId: invoice.id }, "withdrawal invoice cancel failed");
      review.push(ref(invoice));
    }
  }
  return { cancelled, review };
}
