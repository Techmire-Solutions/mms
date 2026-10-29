import {
  dedupeTrimmedIds,
  getOutstandingAmountForInvoice,
  paymentRecordSchema,
  type Invoice,
  type Payment,
  type PaymentCreateInput,
} from "@mms/shared";
import { runInTransaction } from "../../db/database.js";
import { replacePaymentAllocations } from "../../db/repositories/financeBillingRepository.js";
import { tryPostPaymentJournal } from "../../accounting/ledgerPosting/ledgerPostingService.js";
import { getPostingRules } from "../../db/repositories/accountingLedgerOpsRepository.js";
import { resolvePaymentFx } from "./financeDocumentFx.js";
import { recordPaymentAudit } from "./financeAuditEvents.js";
import {
  createFinanceInvoiceMutationOperations,
  type FinanceInvoiceMutationDeps,
} from "../financeInvoiceMutationOperations.js";

const LEDGER_AFFECTING_INVOICE_STATUSES = new Set(["cancelled", "paid"]);

/**
 * Realized FX needs a gain/loss account whenever payments post to the ledger;
 * check before saving so a payment is never stored with a journal that cannot post.
 */
async function assertRealizedFxPostable(tenant: string, realizedFx: number | undefined) {
  if (!realizedFx) return;
  const rules = await getPostingRules(tenant);
  if (rules.cashAccountId && rules.arAccountId && !rules.fxRealizedAccountId) {
    throw Object.assign(
      new Error(
        "Set a realized FX gain/loss account in Accounting → Setup before settling at a new rate",
      ),
      { statusCode: 422, type: "validation_error" },
    );
  }
}

export type FinanceMutationOperationsDeps = FinanceInvoiceMutationDeps;

export function createFinanceMutationOperations({
  repo,
  invoiceCrud,
  requireTenant,
}: FinanceMutationOperationsDeps) {
  return {
    ...createFinanceInvoiceMutationOperations({ repo, invoiceCrud, requireTenant }),

    bulkUpdateInvoicesStatus: async (
      ids: string[],
      status: string,
    ): Promise<{ succeeded: number; failed: number }> => {
      const tenant = requireTenant();
      const cleanIds = dedupeTrimmedIds(ids);
      if (!tenant) return { succeeded: 0, failed: cleanIds.length };
      if (cleanIds.length === 0) return { succeeded: 0, failed: 0 };
      if (LEDGER_AFFECTING_INVOICE_STATUSES.has(status)) {
        throw Object.assign(
          new Error(
            status === "cancelled"
              ? "Cancel invoices through the cancel-invoice action so the ledger reversal is posted"
              : "Record a payment to mark invoices paid — a bulk status write posts nothing to the ledger",
          ),
          { statusCode: 422, type: "validation_error" },
        );
      }
      const result = await repo.bulkUpdateInvoicesStatus(tenant, cleanIds, status);
      const { broadcastTenantUpdate } = await import("../../lib/livePush.js");
      broadcastTenantUpdate(tenant, "collection", "finance_invoices");
      broadcastTenantUpdate(tenant, "collection", "finance_metrics");
      return result;
    },

    createPayment: async (record: PaymentCreateInput): Promise<Payment> => {
      const tenant = requireTenant();
      const resolvedId = String(record.id ?? `pay-${Date.now()}`);
      const normalizedPayment = paymentRecordSchema.parse({ ...record, id: resolvedId }) as Payment;

      // Allocations and the ledger posting live in the same transaction as the
      // payment and balance update: a posting failure must roll the whole
      // payment back rather than leaving cash booked without a journal.
      const settlePayment = async (payment: Payment, invoice?: Invoice) => {
        const allocations = (record.allocations ?? []).map((allocation, index) => ({
          ...allocation,
          id: allocation.id ?? `alloc-${index + 1}`,
        }));
        await replacePaymentAllocations(
          tenant,
          payment.id,
          allocations.length > 0
            ? allocations
            : [
                {
                  id: `alloc-${payment.id}`,
                  invoiceId: payment.invoiceId,
                  amount: payment.invoiceAmount ?? payment.amount,
                },
              ],
        );
        await tryPostPaymentJournal(tenant, payment, invoice);
      };

      const savedPayment = await runInTransaction(async () => {
        const existingPayment = await repo.findPaymentById(tenant, resolvedId);
        if (existingPayment) {
          // Replay: re-affirm allocations and posting idempotently, keep the row.
          await settlePayment(existingPayment);
          return existingPayment;
        }

        // Lock the invoice row: the balance check below is a read-modify-write on
        // `paidAmt`, and without FOR UPDATE two concurrent payments both pass the
        // check and the second overwrites the first (cash collected twice, the
        // invoice showing once).
        const invoice = await repo.findInvoiceById(tenant, normalizedPayment.invoiceId, {
          forUpdate: true,
        });
        if (!invoice || invoice.deletedAt) {
          const err = new Error("Referenced invoice is archived or does not exist");
          (err as Error & { statusCode: number }).statusCode = 400;
          throw err;
        }

        const paymentFx = await resolvePaymentFx(tenant, invoice, normalizedPayment);
        Object.assign(normalizedPayment, paymentFx);
        await assertRealizedFxPostable(tenant, normalizedPayment.realizedFx);

        // Cross-currency payments settle the invoice in its own currency.
        const applied = normalizedPayment.invoiceAmount ?? normalizedPayment.amount;
        const paidAmount = invoice.paidAmt ?? 0;
        const remainingBalance = getOutstandingAmountForInvoice(invoice);
        if (applied > remainingBalance) {
          throw new Error("Payment amount exceeds the remaining invoice balance");
        }

        const newPaid = paidAmount + applied;
        await repo.saveInvoice(tenant, {
          ...invoice,
          status: remainingBalance - applied <= 0 ? "paid" : "partial",
          paidAmt: newPaid,
          paidDate: normalizedPayment.date,
          method: normalizedPayment.method,
        });
        await repo.savePayment(tenant, normalizedPayment);
        await settlePayment(normalizedPayment, invoice);
        await recordPaymentAudit(tenant, normalizedPayment);
        return normalizedPayment;
      });

      const { broadcastTenantUpdate } = await import("../../lib/livePush.js");
      broadcastTenantUpdate(tenant, "collection", "finance_invoices");
      broadcastTenantUpdate(tenant, "collection", "finance_payments");
      return savedPayment;
    },
  };
}
