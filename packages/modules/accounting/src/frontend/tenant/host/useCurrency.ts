import { getAccountingHost, type AccountingCurrencyFormat } from "../host.js";

export function useAccountingCurrency(): AccountingCurrencyFormat {
  return getAccountingHost().useAccountingCurrency();
}
