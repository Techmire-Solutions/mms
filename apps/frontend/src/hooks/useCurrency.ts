import { DEFAULT_CURRENCIES, findIsoCurrency, formatMoney } from "@mms/contracts";
import { useFinanceConfig } from "./useStandardModuleConfig";

export interface UseCurrencyOptions {
  currencyCode?: string;
  decimalPlaces?: number;
}

/**
 * Resolves currency metadata (symbol/name/code) for a code and returns a
 * formatting function pinned to it and to the given decimal places.
 */
export function useCurrency({ currencyCode, decimalPlaces }: UseCurrencyOptions = {}) {
  const activeCurrency = (() => {
    const iso = currencyCode ? findIsoCurrency(currencyCode) : null;
    return (
      DEFAULT_CURRENCIES.find((c) => c.code === currencyCode) ||
      (iso ? { code: iso.code, name: iso.name, symbol: iso.code } : null) ||
      DEFAULT_CURRENCIES[0] || { symbol: "$", code: "USD", name: "US Dollar" }
    );
  })();

  const formatCurrency = (() => {
    return (amount: number | string | null | undefined): string => {
      return formatMoney(amount, activeCurrency.code, {
        useSymbol: true,
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      });
    };
  })();

  return {
    activeCurrency,
    formatCurrency,
  };
}

/**
 * Custom hook to get active currency metadata and a settings-aware formatting function for finance.
 */
export function useFinanceCurrency() {
  const { settings } = useFinanceConfig();
  const { activeCurrency, formatCurrency } = useCurrency({
    currencyCode: settings.currency,
  });
  return {
    activeCurrency,
    formatCurrency,
    settings,
  };
}

export { useAccountingCurrency } from "@mms/mod-accounting/frontend/tenant";
