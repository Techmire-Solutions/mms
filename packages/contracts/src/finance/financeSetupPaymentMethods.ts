/** Canonical payment-method normalization for stored finance settings. */
import {
  FINANCE_PAYMENT_METHODS,
  normalizePaymentMethod,
  type FinancePaymentMethod,
} from "./accountingEnums.js";

/**
 * Canonicalizes stored/settings payment methods (legacy `cash`/`bank_transfer`),
 * drops unknown values and de-duplicates; falls back to the defaults when empty.
 */
export function normalizeFinancePaymentMethods(
  value: unknown,
  fallback: readonly FinancePaymentMethod[],
): FinancePaymentMethod[] {
  const list = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
  const canonical = list
    .map(normalizePaymentMethod)
    .filter((method): method is FinancePaymentMethod =>
      (FINANCE_PAYMENT_METHODS as readonly string[]).includes(method),
    );
  const unique = [...new Set(canonical)];
  return unique.length > 0 ? unique : [...fallback];
}
