/**
 * @file financePaymentAllocationGuards.ts
 * @description Refuses allocation rows that disagree with the payment they belong to.
 *
 * `finance_payment_allocations` is the settlement detail, and nothing in the product reads it —
 * no report, no reconciliation — so a bad row is silent by construction. `createPayment` moves the
 * balance of exactly one invoice (`payment.invoiceId`), which is why an allocation naming another
 * invoice is refused rather than stored against a balance that never changes; and line-level
 * allocation has no foreign key and no reader, so it is refused until it is implemented end to end.
 *
 * Both payment writers call this (create and edit), so the rule cannot drift between them.
 */
import {
  PAYMENT_ALLOCATION_VIOLATION_MESSAGES,
  paymentAllocationViolations,
  type Payment,
  type PaymentAllocation,
  type PaymentUpdate,
} from "@mms/shared";
import { HttpDomainError } from "../../lib/httpErrors.js";

export function assertPaymentAllocationsValid(
  payment: Pick<Payment, "invoiceId" | "amount" | "invoiceAmount">,
  allocations: readonly PaymentAllocation[],
): void {
  const violations = paymentAllocationViolations({
    paymentInvoiceId: payment.invoiceId,
    appliedAmount: payment.invoiceAmount ?? payment.amount,
    allocations,
  });
  if (violations.length === 0) return;
  throw new HttpDomainError(
    422,
    "validation_error",
    PAYMENT_ALLOCATION_VIOLATION_MESSAGES[violations[0]!],
  );
}

/**
 * The edit-path form: resolves the invoice and applied amount an update *will* leave behind.
 *
 * `invoiceAmount` is server-computed and never editable, so an edited `amount` re-derives it to
 * the same value (see `reconcilePaymentEditDeltas`); a moved `invoiceId` changes which invoice the
 * allocations must name.
 */
export function assertPaymentEditAllocationsValid(
  existing: Pick<Payment, "invoiceId" | "amount" | "invoiceAmount">,
  update: Pick<PaymentUpdate, "invoiceId" | "amount">,
  allocations: readonly PaymentAllocation[],
): void {
  assertPaymentAllocationsValid(
    {
      invoiceId: update.invoiceId ?? existing.invoiceId,
      amount: update.amount ?? existing.amount,
      invoiceAmount: existing.invoiceAmount,
    },
    allocations,
  );
}
