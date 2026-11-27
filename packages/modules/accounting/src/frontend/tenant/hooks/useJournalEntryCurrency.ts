import type { JournalEntry } from "@mms/contracts";
import { useAccountingCurrencySettings } from "./useAccountingFx";
import { useDocumentCurrency } from "../host/useDocumentCurrency";
import { entryCurrencyFromLines, entryRateFromLines } from "../index";

/**
 * Entry-level IAS 21 currency for the journal form: every line shares the
 * selected transaction currency. A stored entry keeps its currency and booked rate.
 */
export function useJournalEntryCurrency(initial: JournalEntry | null | undefined, date: string) {
  const functionalCurrency = useAccountingCurrencySettings().data?.functionalCurrency ?? "";
  const lines = initial?.lines ?? [];
  return useDocumentCurrency({
    date,
    initialCurrency: functionalCurrency ? entryCurrencyFromLines(lines, functionalCurrency) : null,
    initialRate: functionalCurrency ? entryRateFromLines(lines, functionalCurrency) : null,
  });
}

export type JournalEntryCurrencyState = ReturnType<typeof useJournalEntryCurrency>;
