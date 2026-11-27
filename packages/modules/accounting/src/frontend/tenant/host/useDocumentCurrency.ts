import { getAccountingHost, type DocumentCurrencyState } from "../host.js";

export function useDocumentCurrency(options?: unknown): DocumentCurrencyState {
  return getAccountingHost().useDocumentCurrency(options);
}
