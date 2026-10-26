import { invertExchangeRate, isValidExchangeRate, previewConvertedAmount } from "@mms/shared";

/**
 * An invoice-currency amount expressed in the payment currency (for balance
 * checks and the "balance due" figure). One side is always functional; the
 * foreign side converts at `rate` (functional units per foreign unit).
 * Null until a usable rate is entered.
 */
export function invoiceAmountInPaymentCurrency(
  amount: number,
  invoiceCurrency: string,
  paymentCurrency: string,
  functionalCurrency: string,
  rate: string,
): number | null {
  if (invoiceCurrency === paymentCurrency) return amount;
  if (!isValidExchangeRate(rate)) return null;
  return invoiceCurrency === functionalCurrency
    ? previewConvertedAmount(amount, invoiceCurrency, paymentCurrency, invertExchangeRate(rate))
    : previewConvertedAmount(amount, invoiceCurrency, paymentCurrency, rate);
}
