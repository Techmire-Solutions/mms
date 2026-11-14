/**
 * @file financePaymentAllocations.ts
 * @description Invariants for the payment → invoice allocation rows.
 *
 * `finance_payment_allocations` is the settlement detail: which invoice (and optionally which
 * line) a payment's applied amount settles. The rows used to be written without any check that
 * they agreed with the payment they belong to, and without any check that they pointed at the
 * invoice the balance was actually updated on — so a payment could record 50.00 against a second
 * invoice that never moved, or an allocation larger than the payment itself, and nothing in the
 * product reads the table to notice (no report, no reconciliation).
 *
 * These checks live in `@mms/shared` because the API is not the only writer: the create and
 * update paths both persist allocations, and the same rules must apply to each.
 */
import type { PaymentAllocation } from "./financeBilling.js";
import { moneyToCents } from "./accountingLedgerInvariants.js";

/** Why a set of allocation rows cannot be persisted. */
export const PAYMENT_ALLOCATION_VIOLATIONS = [
  /** Σ allocations ≠ the amount applied to the invoice. */
  "allocation_total_mismatch",
  /** An allocation names an invoice other than the payment's — the balance path supports one. */
  "allocation_foreign_invoice",
  /** Line-level allocation is not implemented; the id has no FK and no reader. */
  "allocation_line_unsupported",
] as const;

export type PaymentAllocationViolation = (typeof PAYMENT_ALLOCATION_VIOLATIONS)[number];

export interface PaymentAllocationCheckInput {
  /** The invoice the payment settles (its balance is the only one updated). */
  paymentInvoiceId: string;
  /** Amount applied to that invoice, in the invoice currency (`invoiceAmount ?? amount`). */
  appliedAmount: number;
  allocations: readonly PaymentAllocation[];
  /**
   * Whether an allocation targets multiple invoices. Off everywhere today: `createPayment`
   * updates exactly one invoice's `paid_amt`, so a second invoice's allocation would be phantom.
   */
  allowMultipleInvoices?: boolean;
}

/**
 * Returns every way `allocations` disagrees with the payment, in a stable order.
 *
 * An empty list (or no allocations at all) is valid: the caller synthesises the default single
 * allocation for the payment's own invoice.
 */
export function paymentAllocationViolations(
  input: PaymentAllocationCheckInput,
): PaymentAllocationViolation[] {
  const { paymentInvoiceId, appliedAmount, allocations } = input;
  if (allocations.length === 0) return [];

  const violations: PaymentAllocationViolation[] = [];

  const allocatedCents = allocations.reduce(
    (sum, allocation) => sum + moneyToCents(allocation.amount),
    0,
  );
  if (allocatedCents !== moneyToCents(appliedAmount)) {
    violations.push("allocation_total_mismatch");
  }

  if (!input.allowMultipleInvoices) {
    const foreign = allocations.some(
      (allocation) => allocation.invoiceId.trim() !== paymentInvoiceId.trim(),
    );
    if (foreign) violations.push("allocation_foreign_invoice");
  }

  const usesLine = allocations.some((allocation) => Boolean(allocation.invoiceLineId?.trim()));
  if (usesLine) violations.push("allocation_line_unsupported");

  return violations;
}

/** A human-readable reason for each violation, used by the API error message. */
export const PAYMENT_ALLOCATION_VIOLATION_MESSAGES: Readonly<
  Record<PaymentAllocationViolation, string>
> = {
  allocation_total_mismatch:
    "The payment's allocations must add up to the amount applied to its invoice",
  allocation_foreign_invoice:
    "A payment settles one invoice; an allocation may not target a different invoice",
  allocation_line_unsupported:
    "Line-level payment allocation is not supported yet — allocate to the invoice instead",
};
