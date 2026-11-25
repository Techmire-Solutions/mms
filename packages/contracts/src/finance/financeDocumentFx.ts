/**
 * IAS 21 fields shared by finance documents (invoices and payments). A document without `currency` is in the functional currency at
 * rate 1, which is how every pre-multi-currency row reads.
 */
import { currencyMinorUnits, isIsoCurrencyCode } from "../money/iso4217.js";
import { currencyCodeSchema, exchangeRateValueSchema } from "../money/moneySchemas.js";

/**
 * Finance amounts are still two-decimal numbers, so a document currency may
 * have at most two minor units (KWD / BHD / OMR wait for decimal-string DTOs).
 */
export function isSupportedDocumentCurrency(code: string): boolean {
  return isIsoCurrencyCode(code) && currencyMinorUnits(code) <= 2;
}

export const documentCurrencySchema = currencyCodeSchema.refine(isSupportedDocumentCurrency, {
  message: "finance.validation.documentCurrencyScale",
});

/** `currency` + booked `exchangeRate` (functional units per one document unit). */
export const documentFxFields = {
  currency: documentCurrencySchema.optional(),
  exchangeRate: exchangeRateValueSchema.optional(),
};

/** The document's currency, defaulting to the functional currency. */
export function documentCurrency(
  record: { currency?: string | null },
  functionalCurrency: string,
): string {
  return record.currency || functionalCurrency;
}

/** True when the document is in a currency other than the functional one. */
export function isForeignDocument(
  record: { currency?: string | null },
  functionalCurrency: string,
): boolean {
  return documentCurrency(record, functionalCurrency) !== functionalCurrency;
}
