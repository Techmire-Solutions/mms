import type { JournalEntry } from "@mms/contracts";
import { useAccountingCurrencySettings } from "@/tenant/features/accounting/hooks/useAccountingFx";
import { useDocumentCurrency } from "@/tenant/hooks/useDocumentCurrency";
import { entryCurrencyFromLines, entryRateFromLines } from "@mms/mod-accounting/frontend/tenant";

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
