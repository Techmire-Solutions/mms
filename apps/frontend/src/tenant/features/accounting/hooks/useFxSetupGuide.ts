import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { ACCOUNTING_MODULE_MANIFEST, todayISO } from "@mms/shared";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import {
  exchangeRateLookupQueryOptions,
  useAccountingCurrencySettings,
} from "@/tenant/features/accounting/hooks/useAccountingFx";
import { useAccountingPostingRules } from "@/tenant/features/accounting/hooks/useAccountingLedgerOps";
import { computeFxSetupReadiness } from "../lib/fxSetupReadiness";

/**
 * Live multi-currency readiness for the viewer: saved currencies, today's rate
 * per currency (tenant rate, inverse or feed) and the FX posting accounts.
 */
export function useFxSetupGuide() {
  const { canWrite, canEditSetup } = useModulePermissions(ACCOUNTING_MODULE_MANIFEST);
  const settings = useAccountingCurrencySettings();
  const rules = useAccountingPostingRules();
  const functionalCurrency = settings.data?.functionalCurrency ?? "";
  const enabledCurrencies = useMemo(
    () => settings.data?.enabledCurrencies ?? [],
    [settings.data?.enabledCurrencies],
  );
  const today = todayISO();

  const lookups = useQueries({
    queries: enabledCurrencies.map((code) =>
      exchangeRateLookupQueryOptions(
        functionalCurrency
          ? { fromCurrency: code, toCurrency: functionalCurrency, date: today }
          : null,
      ),
    ),
  });
  const rateOnFile = new Map(
    enabledCurrencies.map((code, index) => {
      const lookup = lookups[index];
      if (lookup?.isSuccess) return [code, lookup.data !== null] as const;
      return [code, lookup?.isError ? false : undefined] as const;
    }),
  );

  const readiness = computeFxSetupReadiness({
    enabledCurrencies,
    rateOnFile,
    postingRules: rules.isError ? {} : rules.data,
    canEditSetup,
    canWrite,
  });

  return {
    readiness,
    functionalCurrency,
    enabledCurrencies,
    isLoading: settings.isLoading,
    isError: settings.isError,
  };
}

export type FxSetupGuideState = ReturnType<typeof useFxSetupGuide>;
