import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AccountingCurrencySettings,
  AccountingCurrencySettingsPut,
  CurrencyExchangeability,
  CurrencyExchangeabilityPut,
  ExchangeRateListQuery,
  ExchangeRateLookupResult,
  ExchangeRatePutItem,
  ExchangeRateRecord,
  ExchangeRateType,
} from "@mms/shared";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { invalidateAccountingQueries } from "@/tenant/features/accounting/hooks/invalidateAccountingQueries";

const FX_KEY = ["accounting", "fx"] as const;
export const ACCOUNTING_CURRENCY_SETTINGS_QUERY_KEY = [...FX_KEY, "currency-settings"] as const;
const RATES_KEY = [...FX_KEY, "exchange-rates"] as const;
const LOOKUP_KEY = [...FX_KEY, "rate-lookup"] as const;

function assertOk(response: { status: number; body: unknown }, context: string): void {
  if (response.status >= 200 && response.status < 300) return;
  const errorBody = response.body as { message?: string; type?: string } | undefined;
  throw new ApiError(response.status, errorBody?.message ?? context, errorBody?.type);
}

export function useAccountingCurrencySettings(enabled = true) {
  return useQuery({
    queryKey: ACCOUNTING_CURRENCY_SETTINGS_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.accountingFx.getCurrencySettings({
        signal,
        fetchOptions: { signal },
      });
      assertOk(response, "Failed to load currency settings");
      return (response.body as { settings: AccountingCurrencySettings }).settings;
    },
    enabled,
  });
}

export function useSaveAccountingCurrencySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: AccountingCurrencySettingsPut) => {
      const response = await apiContract.accountingFx.putCurrencySettings({ body });
      assertOk(response, "Failed to save currency settings");
      return (response.body as { settings: AccountingCurrencySettings }).settings;
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(ACCOUNTING_CURRENCY_SETTINGS_QUERY_KEY, settings);
      invalidateAccountingQueries(queryClient);
    },
  });
}

export function useAccountingExchangeRates(query: ExchangeRateListQuery = {}, enabled = true) {
  return useQuery({
    queryKey: [...RATES_KEY, query],
    queryFn: async ({ signal }) => {
      const response = await apiContract.accountingFx.listExchangeRates({
        query,
        signal,
        fetchOptions: { signal },
      });
      assertOk(response, "Failed to load exchange rates");
      return (response.body as { rates: ExchangeRateRecord[] }).rates;
    },
    enabled,
  });
}

/** Money mutation: no optimistic update; lists and lookups refetch after the save. */
export function useSaveAccountingExchangeRates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rates: ExchangeRatePutItem[]) => {
      const response = await apiContract.accountingFx.putExchangeRates({ body: { rates } });
      assertOk(response, "Failed to save exchange rates");
      return (response.body as { rates: ExchangeRateRecord[] }).rates;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RATES_KEY });
      void queryClient.invalidateQueries({ queryKey: LOOKUP_KEY });
    },
  });
}

export interface ExchangeRateLookupInput {
  fromCurrency: string;
  toCurrency: string;
  date: string;
  rateType?: ExchangeRateType;
}

/**
 * The rate in force on `date`; resolves to `null` (not an error) when none is on
 * file so forms can ask the user for one instead of assuming 1.
 */
export function useExchangeRateLookup(input: ExchangeRateLookupInput | null) {
  return useQuery({
    queryKey: [...LOOKUP_KEY, input],
    queryFn: async ({ signal }): Promise<ExchangeRateLookupResult | null> => {
      if (!input) return null;
      const response = await apiContract.accountingFx.lookupExchangeRate({
        query: { ...input, rateType: input.rateType ?? "SPOT" },
        signal,
        fetchOptions: { signal },
      });
      if (response.status === 404) return null;
      assertOk(response, "Failed to look up exchange rate");
      return (response.body as { rate: ExchangeRateLookupResult }).rate;
    },
    enabled: input !== null && input.fromCurrency !== input.toCurrency,
  });
}

const EXCHANGEABILITY_KEY = [...FX_KEY, "exchangeability"] as const;

/** Currencies assessed as not exchangeable (IAS 21, 2025 amendment). */
export function useCurrencyExchangeability(enabled = true) {
  return useQuery({
    queryKey: EXCHANGEABILITY_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.accountingFx.listExchangeability({
        signal,
        fetchOptions: { signal },
      });
      assertOk(response, "Failed to load exchangeability assessments");
      return (response.body as { currencies: CurrencyExchangeability[] }).currencies;
    },
    enabled,
  });
}

export function useSaveCurrencyExchangeability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CurrencyExchangeabilityPut) => {
      const response = await apiContract.accountingFx.putExchangeability({ body });
      assertOk(response, "Failed to save exchangeability assessments");
      return (response.body as { currencies: CurrencyExchangeability[] }).currencies;
    },
    onSuccess: (currencies) => {
      queryClient.setQueryData(EXCHANGEABILITY_KEY, currencies);
      void queryClient.invalidateQueries({ queryKey: LOOKUP_KEY });
    },
  });
}
