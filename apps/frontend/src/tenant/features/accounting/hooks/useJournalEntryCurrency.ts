import { useEffect, useMemo, useState } from "react";
import type { JournalEntry } from "@mms/shared";
import {
  useAccountingCurrencySettings,
  useExchangeRateLookup,
} from "@/tenant/features/accounting/hooks/useAccountingFx";
import { entryCurrencyFromLines, entryRateFromLines } from "../lib/journalEntryCurrency";

/**
 * Entry-level IAS 21 currency for the journal form: every line shares the
 * selected transaction currency. The rate defaults to the one in force on the
 * entry date and may be overridden; a stored entry keeps its booked rate.
 */
export function useJournalEntryCurrency(initial: JournalEntry | null | undefined, date: string) {
  const settings = useAccountingCurrencySettings();
  const functionalCurrency = settings.data?.functionalCurrency ?? "";
  const [currency, setCurrency] = useState("");
  const [rateOverride, setRateOverride] = useState("");

  useEffect(() => {
    if (!functionalCurrency) return;
    const lines = initial?.lines ?? [];
    setCurrency(entryCurrencyFromLines(lines, functionalCurrency));
    setRateOverride(entryRateFromLines(lines, functionalCurrency));
  }, [initial, functionalCurrency]);

  const effectiveCurrency = currency || functionalCurrency;
  const isForeign = Boolean(functionalCurrency) && effectiveCurrency !== functionalCurrency;
  const lookup = useExchangeRateLookup(
    isForeign && date
      ? { fromCurrency: effectiveCurrency, toCurrency: functionalCurrency, date }
      : null,
  );

  const currencyOptions = useMemo(
    () =>
      [functionalCurrency, ...(settings.data?.enabledCurrencies ?? [])]
        .filter(Boolean)
        .map((code) => ({ value: code, label: code })),
    [functionalCurrency, settings.data?.enabledCurrencies],
  );

  return {
    functionalCurrency,
    currency: effectiveCurrency,
    setCurrency: (next: string) => {
      setCurrency(next);
      setRateOverride("");
    },
    isForeign,
    rate: rateOverride || lookup.data?.rate || "",
    rateOverride,
    setRateOverride,
    lookedUpRate: lookup.data ?? null,
    rateMissing: isForeign && !rateOverride && lookup.isSuccess && !lookup.data,
    currencyOptions,
    /** Only offer the picker once foreign currencies are enabled. */
    showCurrencyPicker: currencyOptions.length > 1 || isForeign,
  };
}

export type JournalEntryCurrencyState = ReturnType<typeof useJournalEntryCurrency>;
