import type { Payment, PaymentUpdate } from "@mms/shared";

/** Fields whose persisted change desynchronises a payment from its posted journal. */
export const LEDGER_SENSITIVE_PAYMENT_FIELDS = [
  "amount",
  "invoiceId",
  "date",
  "currency",
  "exchangeRate",
  "allocations",
] as const;

function cents(value: unknown): number {
  return Math.round(Number(value ?? 0) * 100);
}

function allocationsSignature(allocations: PaymentUpdate["allocations"]): string {
  const rows = (allocations ?? []).map((entry, index) => ({
    id: entry.id ?? `#${index}`,
    invoiceId: entry.invoiceId,
    invoiceLineId: entry.invoiceLineId ?? null,
    amount: cents(entry.amount),
  }));
  rows.sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(rows);
}

/**
 * Returns the ledger-sensitive fields a payment update would change.
 *
 * Exported for the regression test; the guard below is the only caller in
 * production code.
 */
export function paymentLedgerSensitiveChanges(
  existing: Payment,
  incoming: PaymentUpdate,
): string[] {
  const changed: string[] = [];

  if (incoming.amount !== undefined && cents(incoming.amount) !== cents(existing.amount)) {
    changed.push("amount");
  }
  if (incoming.invoiceId !== undefined && incoming.invoiceId !== existing.invoiceId) {
    changed.push("invoiceId");
  }
  if (incoming.date !== undefined && incoming.date !== existing.date) {
    changed.push("date");
  }
  if (
    incoming.currency !== undefined &&
    (incoming.currency ?? "").toLowerCase() !== (existing.currency ?? "").toLowerCase()
  ) {
    changed.push("currency");
  }
  if (
    incoming.exchangeRate !== undefined &&
    Number(incoming.exchangeRate ?? 0) !== Number(existing.exchangeRate ?? 0)
  ) {
    changed.push("exchangeRate");
  }
  if (
    incoming.allocations !== undefined &&
    allocationsSignature(incoming.allocations) !== allocationsSignature(existing.allocations)
  ) {
    changed.push("allocations");
  }

  return changed;
}

/**
 * A posted payment is a ledger document. Editing its money, invoice, date,
 * currency or allocations would leave the journal and `invoice.paidAmt` behind,
 * so callers must archive and re-enter it. Metadata edits stay allowed.
 */
export function assertPaymentLedgerFieldsUnchanged(
  existing: Payment,
  incoming: PaymentUpdate,
  isPosted: boolean,
): void {
  if (!isPosted) return;
  const changed = paymentLedgerSensitiveChanges(existing, incoming);
  if (changed.length === 0) return;

  throw Object.assign(
    new Error(
      `This payment is posted to the ledger — archive it and re-enter the payment instead of editing ${changed.join(", ")}`,
    ),
    { statusCode: 422, type: "validation_error" },
  );
}
