import {
  documentCurrency,
  stampDocumentFxLines,
  type DocumentFxContext,
  type JournalLine,
  type PostingRules,
} from "@mms/shared";
import { getCurrencySettings } from "../../db/repositories/accountingCurrencySettingsRepository.js";

/**
 * IAS 21 context for posting a finance document: its currency, the functional
 * currency and the document's booked rate. A foreign document without a stored
 * rate is a data error — posting fails rather than assuming a rate of 1.
 */
export async function documentFxContext(
  tenant: string,
  document: { currency?: string | null; exchangeRate?: string | null; id?: string },
  entryDate: string,
  accounts: PostingRules,
): Promise<DocumentFxContext> {
  const { functionalCurrency } = await getCurrencySettings(tenant);
  const currency = documentCurrency(document, functionalCurrency);
  if (currency !== functionalCurrency && !document.exchangeRate) {
    throw Object.assign(
      new Error(`Document ${document.id ?? ""} in ${currency} has no booked exchange rate`),
      { statusCode: 422, type: "validation_error" },
    );
  }
  return {
    currency,
    functionalCurrency,
    rate: currency === functionalCurrency ? "1" : (document.exchangeRate as string),
    entryDate,
    roundingAccountId: accounts.fxRoundingAccountId,
  };
}

/** Lines built in the document currency → IAS 21 dual-amount lines at the booked rate. */
export async function stampLinesForDocument(
  tenant: string,
  document: { currency?: string | null; exchangeRate?: string | null; id?: string },
  entryDate: string,
  accounts: PostingRules,
  lines: readonly JournalLine[],
): Promise<JournalLine[]> {
  return stampDocumentFxLines(lines, await documentFxContext(tenant, document, entryDate, accounts));
}
