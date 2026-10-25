import { formatMoney } from "@mms/shared";

/**
 * Format an amount in its document's currency. Functional-currency documents
 * (no `currency`) keep the module's settings-aware formatter.
 */
export function formatDocumentAmount(
  record: { currency?: string | null },
  amount: number | null | undefined,
  formatFunctional: (amount: number) => string,
): string {
  const value = amount ?? 0;
  return record.currency
    ? formatMoney(value, record.currency, { useSymbol: true })
    : formatFunctional(value);
}
