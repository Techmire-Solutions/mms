import {
  DEFAULT_ACCOUNTING_SETTINGS,
  DEFAULT_CURRENCIES,
  findIsoCurrency,
  formatMoney,
} from "@mms/contracts";
import { useAccountingPreferencesQuery } from "./useAccountingSetupConfig";
import { useAccountingCurrencySettings } from "./useAccountingFx";

/**
 * Settings-aware currency metadata and formatter for accounting.
 * Reads stored preferences, with the functional currency as the SSOT for ledger amounts.
 */
export function useAccountingCurrency() {
  const prefsQuery = useAccountingPreferencesQuery();
  const settings = (prefsQuery.data ??
    DEFAULT_ACCOUNTING_SETTINGS) as typeof DEFAULT_ACCOUNTING_SETTINGS;
  const fxSettings = useAccountingCurrencySettings();
  const currencyCode = fxSettings.data?.functionalCurrency ?? settings.currency;
  const iso = currencyCode ? findIsoCurrency(currencyCode) : null;
  const activeCurrency = DEFAULT_CURRENCIES.find((c) => c.code === currencyCode) ||
    (iso ? { code: iso.code, name: iso.name, symbol: iso.code } : null) ||
    DEFAULT_CURRENCIES[0] || { symbol: "$", code: "USD", name: "US Dollar" };
  const formatCurrency = (amount: number | string | null | undefined): string =>
    formatMoney(amount, activeCurrency.code, {
      useSymbol: true,
      minimumFractionDigits: settings.decimalPlaces,
      maximumFractionDigits: settings.decimalPlaces,
    });
  return { activeCurrency, formatCurrency, settings };
}
