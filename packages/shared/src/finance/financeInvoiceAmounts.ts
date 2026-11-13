/** Invoice amount derivations (collected / outstanding, per record and per month). */
import type { Invoice } from "./financeInvoiceTypes.js";
import { moneyToCents } from "./accountingLedgerInvariants.js";

/**
 * Calculates the collected amount for a single invoice.
 * Handles "paid" (returns finalAmt) and "partial" (returns paidAmt or 50% default fallback).
 *
 * @param invoice - The invoice record.
 * @returns The collected amount.
 */
export function getCollectedAmountForInvoice(invoice: Invoice): number {
  if (invoice.status === "paid") {
    return invoice.finalAmt;
  }
  if (invoice.status === "partial") {
    return invoice.paidAmt !== undefined && invoice.paidAmt !== null ? invoice.paidAmt : 0;
  }
  return 0;
}

/**
 * Calculates the outstanding amount for a single invoice.
 * Handles unpaid/uncollected balances for pending, partial, or overdue invoices.
 *
 * @param invoice - The invoice record.
 * @returns The outstanding amount.
 */
export function getOutstandingAmountForInvoice(invoice: Invoice): number {
  if (invoice.status === "cancelled" || invoice.status === "paid") {
    return 0;
  }
  // Integer cents: four 2 dp floats added and subtracted can leave 0.0100000000002
  // style residue, which flips the `applied > remaining` check in createPayment.
  const outstandingCents =
    moneyToCents(invoice.finalAmt) +
    moneyToCents(invoice.lateFeeAmt ?? 0) -
    moneyToCents(invoice.creditedAmt ?? 0) -
    moneyToCents(invoice.paidAmt ?? 0);
  return Math.max(0, outstandingCents) / 100;
}

/**
 * Calculates the total collected amount from invoices for a specific month and year.
 *
 * @param invoices - The list of invoices to aggregate.
 * @param year - The year (e.g. 2026).
 * @param month - The month index (0-11, e.g. 0 for January).
 * @returns The total collected amount.
 */
export function getCollectedAmountForMonth(
  invoices: Invoice[],
  year: number,
  month: number,
): number {
  let sumCents = 0;
  invoices.forEach((inv) => {
    if (!inv || inv.status === "cancelled") return;
    const dateStr = inv.paidDate || inv.dueDate || "";
    if (!dateStr) return;
    const invYear = Number(dateStr.slice(0, 4));
    const invMonth = Number(dateStr.slice(5, 7)) - 1;
    if (invYear === year && invMonth === month) {
      // Integer cents: a float month total drifts into 0.30000000000000004.
      sumCents += moneyToCents(getCollectedAmountForInvoice(inv));
    }
  });
  return sumCents / 100;
}

/**
 * Calculates the total outstanding amount from invoices for a specific month and year.
 *
 * @param invoices - The list of invoices to aggregate.
 * @param year - The year (e.g. 2026).
 * @param month - The month index (0-11, e.g. 0 for January).
 * @returns The total outstanding amount.
 */
export function getOutstandingAmountForMonth(
  invoices: Invoice[],
  year: number,
  month: number,
): number {
  let sumCents = 0;
  invoices.forEach((inv) => {
    if (!inv || inv.status === "cancelled" || inv.status === "paid") return;
    const dateStr = inv.dueDate || "";
    if (!dateStr) return;
    const invYear = Number(dateStr.slice(0, 4));
    const invMonth = Number(dateStr.slice(5, 7)) - 1;
    if (invYear === year && invMonth === month) {
      sumCents += moneyToCents(getOutstandingAmountForInvoice(inv));
    }
  });
  return sumCents / 100;
}
