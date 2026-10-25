import type React from "react";
import { formatMoney } from "@mms/shared";
import { DocumentCurrencyFields } from "@/components/app/DocumentCurrencyFields";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { JournalEntryCurrencyState } from "../hooks/useJournalEntryCurrency";
import { functionalPreview } from "../lib/journalEntryCurrency";

interface JournalEntryCurrencyFieldsProps {
  t: TranslationFunction;
  fx: JournalEntryCurrencyState;
  total: number;
  error?: string;
}

/** Transaction currency + exchange rate for a journal entry, with the functional debit total. */
export function JournalEntryCurrencyFields({
  t,
  fx,
  total,
  error,
}: JournalEntryCurrencyFieldsProps): React.JSX.Element | null {
  const preview = functionalPreview(total, fx.currency, fx.functionalCurrency, fx.rate);
  return (
    <DocumentCurrencyFields
      t={t}
      idPrefix="je"
      fx={fx}
      error={error}
      preview={{
        label: t("fx.field.functionalEquivalent"),
        value: preview === null ? "—" : formatMoney(preview, fx.functionalCurrency, { useSymbol: true }),
      }}
    />
  );
}
