import { getOutstandingAmountForInvoice, moneyToCents } from "@mms/shared";
import type { Invoice, Payment } from "@mms/shared";
import type { FinanceRepository } from "../repository/financeRepository.js";

type DeltaRepo = Pick<FinanceRepository, "findInvoicesByIds" | "saveInvoice">;

/** Total the invoice must collect before it counts as settled. */
export function invoiceTotalDue(invoice: Invoice): number {
  return invoice.finalAmt + (invoice.lateFeeAmt ?? 0) - (invoice.creditedAmt ?? 0);
}

/**
 * Applies a change in collected amount and re-derives the status.
 *
 * A fully un-collected invoice returns to `pending` rather than guessing at
 * `overdue` — `collectOverdueInvoices` owns that transition and will re-mark it
 * on its next sweep.
 */
export function applyCollectedDelta(invoice: Invoice, delta: number): Invoice {
  // Integer cents end-to-end: `paidAmt + delta` over 2 dp floats can drift a cent
  // per archive/restore cycle and flip the derived status.
  const paidCents = Math.max(0, moneyToCents(invoice.paidAmt ?? 0) + moneyToCents(delta));
  const dueCents = moneyToCents(invoiceTotalDue(invoice));
  return {
    ...invoice,
    paidAmt: paidCents / 100,
    status: paidCents <= 0 ? "pending" : paidCents >= dueCents ? "paid" : "partial",
  };
}

/**
 * Rolls archived/restored payments off their invoices.
 *
 * The subledger balance is tracked in the invoice currency: a cross-currency
 * payment stores both the cash `amount` (payment currency) and the applied
 * `invoiceAmount` (invoice currency), and only the latter matches `paidAmt`.
 * Rows are locked because this is a read-modify-write that races `createPayment`.
 */
export async function applyPaymentDeltas(
  repo: DeltaRepo,
  tenant: string,
  payments: readonly Payment[],
  direction: 1 | -1,
): Promise<void> {
  const deltaByInvoice = new Map<string, number>();
  for (const payment of payments) {
    const applied = payment.invoiceAmount ?? payment.amount;
    deltaByInvoice.set(
      payment.invoiceId,
      (deltaByInvoice.get(payment.invoiceId) ?? 0) + applied * direction,
    );
  }
  const invoices = await repo.findInvoicesByIds(tenant, [...deltaByInvoice.keys()], {
    includeDeleted: true,
    forUpdate: true,
  });
  for (const invoice of invoices) {
    // A cancelled invoice has already had its posting reversed; re-deriving its
    // status from the collected amount would silently revive it.
    if (invoice.status === "cancelled") continue;
    const delta = deltaByInvoice.get(invoice.id);
    if (!delta) continue;
    await repo.saveInvoice(tenant, applyCollectedDelta(invoice, delta));
  }
}

/**
 * Re-derives the invoice balance after an edit to an **unposted** payment.
 *
 * `createPayment` always moves `invoice.paidAmt`, with or without posting rules;
 * editing the amount/invoice of a payment that has no ledger row must therefore
 * reverse the old applied amount and apply the new one, under the same invoice
 * lock, or the subledger drifts from the sum of its payments.
 */
export async function reconcilePaymentEditDeltas(
  repo: DeltaRepo,
  tenant: string,
  before: Payment,
  after: Payment,
): Promise<void> {
  const invoiceIds = [...new Set([before.invoiceId, after.invoiceId])];
  const invoices = await repo.findInvoicesByIds(tenant, invoiceIds, {
    includeDeleted: true,
    forUpdate: true,
  });
  const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const deltaByInvoice = new Map<string, number>();
  const add = (invoiceId: string, delta: number) =>
    deltaByInvoice.set(invoiceId, (deltaByInvoice.get(invoiceId) ?? 0) + delta);

  add(before.invoiceId, -(before.invoiceAmount ?? before.amount));
  add(after.invoiceId, after.invoiceAmount ?? after.amount);

  for (const [invoiceId, delta] of deltaByInvoice) {
    if (!delta) continue;
    const invoice = byId.get(invoiceId);
    if (!invoice) continue;
    if (invoice.status === "cancelled") {
      throw Object.assign(new Error("Cannot move a payment to or from a cancelled invoice"), {
        statusCode: 422,
        type: "validation_error",
      });
    }
    const remainingCents = moneyToCents(getOutstandingAmountForInvoice(invoice));
    if (delta > remainingCents) {
      throw Object.assign(new Error("Payment amount exceeds the remaining invoice balance"), {
        statusCode: 422,
        type: "validation_error",
      });
    }
    await repo.saveInvoice(tenant, applyCollectedDelta(invoice, delta));
  }
}
