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
  const paidAmt = Math.max(0, (invoice.paidAmt ?? 0) + delta);
  const totalDue = invoiceTotalDue(invoice);
  return {
    ...invoice,
    paidAmt,
    status: paidAmt <= 0 ? "pending" : paidAmt >= totalDue ? "paid" : "partial",
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
