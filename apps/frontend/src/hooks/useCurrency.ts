import { DEFAULT_CURRENCIES, formatMoney } from "@mms/shared";
import { useFinanceConfig, useAccountingConfig } from "./useStandardModuleConfig";
import { useAccountingPreferencesQuery } from "@/tenant/features/accounting/hooks/useAccountingSetupConfig";

export interface UseCurrencyOptions {
  currencyCode?: string;
  decimalPlaces?: number;
}

export function useCurrency({ currencyCode, decimalPlaces }: UseCurrencyOptions = {}) {
  const activeCurrency = (() => {
    return (
      DEFAULT_CURRENCIES.find((c) => c.code === currencyCode) ||
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

/**
 * Custom hook to get active currency metadata and a settings-aware formatting function for accounting.
 *
 * The formatting settings come from the **stored** accounting preferences, not
 * from the module-config stub (`useAccountingConfig()` returns `defaultSettings`
 * with a no-op setter, so every money figure in the module was rendered with the
 * built-in defaults even when the workspace had configured its own currency,
 * symbol, decimal separator or decimal places).
 *
 * The stub is still the fallback so a caller outside a preferences query — or a
 * render before the query resolves — keeps working.
 */
export function useAccountingCurrency() {
  const { settings: fallbackSettings } = useAccountingConfig();
  const prefsQuery = useAccountingPreferencesQuery();
  const settings = (prefsQuery.data ?? fallbackSettings) as typeof fallbackSettings;
  const { activeCurrency, formatCurrency } = useCurrency({
    currencyCode: settings.currency,
    decimalPlaces: settings.decimalPlaces,
  });
  return {
    activeCurrency,
    formatCurrency,
    settings,
  };
}
