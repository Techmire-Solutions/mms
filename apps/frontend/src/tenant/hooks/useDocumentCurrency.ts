import { useMemo, useState } from "react";
import {
  useAccountingCurrencySettings,
  useExchangeRateLookup,
} from "@/tenant/hooks/collections/accounting";

export interface UseDocumentCurrencyOptions {
  /** Rate date (document or posting date). */
  date: string;
  /** Currency to start from (an edited document's stored currency). */
  initialCurrency?: string | null;
  /** Stored or overridden rate to start from. */
  initialRate?: string | null;
  /** Foreign currencies to offer besides the functional one (default: all enabled currencies). */
  allowedCurrencies?: readonly string[];
  /**
   * The other side of a settlement (a payment's invoice currency). A functional
   * payment against a foreign invoice still needs that currency's rate.
   */
  counterCurrency?: string | null;
}

/**
 * IAS 21 currency + exchange-rate state for any document form (journal entry,
 * invoice, payment). The rate defaults to the one in force on `date` and may be
 * overridden; a missing rate is surfaced, never replaced with 1.
 */
export function useDocumentCurrency({
  date,
  initialCurrency,
  initialRate,
  allowedCurrencies,
  counterCurrency,
}: UseDocumentCurrencyOptions) {
  const settings = useAccountingCurrencySettings();
  const functionalCurrency = settings.data?.functionalCurrency ?? "";
  const [currency, setCurrencyState] = useState(() =>
    functionalCurrency ? initialCurrency || functionalCurrency : "",
  );
  const [rateOverride, setRateOverride] = useState(() =>
    functionalCurrency ? (initialRate ?? "") : "",
  );

  // Adjust state during render: a loaded functional currency (or a new document seed) re-seeds the
  // selected currency and rate override from the document's stored values.
  const [prevSeedInputs, setPrevSeedInputs] = useState({
    functionalCurrency,
    initialCurrency,
    initialRate,
  });
  if (
    prevSeedInputs.functionalCurrency !== functionalCurrency ||
    prevSeedInputs.initialCurrency !== initialCurrency ||
    prevSeedInputs.initialRate !== initialRate
  ) {
    setPrevSeedInputs({ functionalCurrency, initialCurrency, initialRate });
    if (functionalCurrency) {
      setCurrencyState(initialCurrency || functionalCurrency);
      setRateOverride(initialRate ?? "");
    }
  }

  const effectiveCurrency = currency || functionalCurrency;
  const currencyOptions = useMemo(() => {
    const codes = [
      functionalCurrency,
      ...(allowedCurrencies ?? settings.data?.enabledCurrencies ?? []),
    ];
    return [...new Set(codes.filter(Boolean))].map((code) => ({ value: code, label: code }));
  }, [allowedCurrencies, functionalCurrency, settings.data?.enabledCurrencies]);

  const isForeign = Boolean(functionalCurrency) && effectiveCurrency !== functionalCurrency;
  const rateCurrency = isForeign
    ? effectiveCurrency
    : counterCurrency && functionalCurrency && counterCurrency !== functionalCurrency
      ? counterCurrency
      : null;
  const lookup = useExchangeRateLookup(
    rateCurrency && date
      ? { fromCurrency: rateCurrency, toCurrency: functionalCurrency, date }
      : null,
  );

  return {
    functionalCurrency,
    currency: effectiveCurrency,
    setCurrency: (next: string) => {
      setCurrencyState(next);
      setRateOverride("");
    },
    isForeign,
    /** The foreign currency whose rate applies, or null when everything is functional. */
    rateCurrency,
    needsRate: rateCurrency !== null,
    rate: rateOverride || lookup.data?.rate || "",
    rateOverride,
    setRateOverride,
    lookedUpRate: lookup.data ?? null,
    rateMissing: rateCurrency !== null && !rateOverride && lookup.isSuccess && !lookup.data,
    currencyOptions,
    /** Only offer the picker once there is more than one currency to choose from. */
    showCurrencyPicker: currencyOptions.length > 1 || rateCurrency !== null,
  };
}

export type DocumentCurrencyState = ReturnType<typeof useDocumentCurrency>;
