import {
  computeRealizedFx,
  documentCurrency,
  moneyToDecimalString,
  settlementInvoiceAmount,
  type Invoice,
} from "@mms/shared";
import { accountingFxRepository } from "../../accounting/repository/accountingFxRepositoryAdapter.js";
import type { AccountingFxRepository } from "../../accounting/repository/accountingFxRepository.js";

function validationError(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 422, type: "validation_error" });
}

/** Stored IAS 21 fields: both absent for a functional-currency document. */
export interface ResolvedDocumentFx {
  currency?: string;
  exchangeRate?: string;
}

/**
 * Resolve a new document's currency and booked rate. Functional-currency
 * documents store neither field (read back as rate 1). A foreign document must
 * use an enabled currency; its rate is the caller's override or the latest SPOT
 * rate on or before `date`, and a missing rate is a 422, never 1.
 */
export async function resolveDocumentFx(
  tenant: string,
  input: { currency?: string | null; exchangeRate?: string | null },
  date: string,
  fx: AccountingFxRepository = accountingFxRepository,
): Promise<ResolvedDocumentFx> {
  const settings = await fx.getCurrencySettings(tenant);
  const currency = documentCurrency(input, settings.functionalCurrency);
  if (currency === settings.functionalCurrency) return {};
  if (!settings.enabledCurrencies.includes(currency)) {
    throw validationError(`Currency ${currency} is not enabled for this workspace`);
  }
  if (input.exchangeRate) return { currency, exchangeRate: input.exchangeRate };
  const found = await fx.lookupExchangeRate(tenant, {
    fromCurrency: currency,
    toCurrency: settings.functionalCurrency,
    date,
    rateType: "SPOT",
  });
  if (!found) {
    throw validationError(
      `No ${currency}→${settings.functionalCurrency} rate on or before ${date}; add one under Accounting → Setup`,
    );
  }
  return { currency, exchangeRate: found.rate };
}

/**
 * IAS 21 fields for a payment against `invoice`. The payment may be in the
 * invoice currency or the functional currency (cross-currency settlement): the
 * foreign side converts at the payment-date rate, the applied invoice amount is
 * stored, and realized FX is measured against the invoice booked rate.
 */
export async function resolvePaymentFx(
  tenant: string,
  invoice: Pick<Invoice, "currency" | "exchangeRate">,
  payment: { amount: number; date: string; currency?: string | null; exchangeRate?: string | null },
  fx: AccountingFxRepository = accountingFxRepository,
): Promise<ResolvedDocumentFx & { realizedFx?: number; invoiceAmount?: number }> {
  const { functionalCurrency } = await fx.getCurrencySettings(tenant);
  const invoiceCurrency = documentCurrency(invoice, functionalCurrency);
  const paymentCurrency = payment.currency || invoiceCurrency;
  if (paymentCurrency !== invoiceCurrency && paymentCurrency !== functionalCurrency) {
    throw validationError(
      `A ${invoiceCurrency} invoice can be paid in ${invoiceCurrency} or ${functionalCurrency}`,
    );
  }
  const foreignCurrency = paymentCurrency !== functionalCurrency ? paymentCurrency : invoiceCurrency;
  if (foreignCurrency === functionalCurrency) return {};
  if (invoiceCurrency !== functionalCurrency && !invoice.exchangeRate) {
    throw validationError("The invoice has no booked exchange rate");
  }
  const { exchangeRate } = await resolveDocumentFx(
    tenant,
    { currency: foreignCurrency, exchangeRate: payment.exchangeRate },
    payment.date,
    fx,
  );
  const settlementRate = exchangeRate as string;
  const invoiceAmount = settlementInvoiceAmount({
    amount: payment.amount,
    paymentCurrency,
    invoiceCurrency,
    functionalCurrency,
    settlementRate,
  });
  const realized = computeRealizedFx({
    amount: payment.amount,
    paymentCurrency,
    invoiceAmount,
    invoiceCurrency,
    functionalCurrency,
    bookedRate: invoice.exchangeRate ?? "1",
    settlementRate,
  });
  return {
    currency: paymentCurrency,
    exchangeRate: settlementRate,
    invoiceAmount,
    realizedFx: Number(moneyToDecimalString(realized)),
  };
}
