import type React from "react";
import { formatMoney } from "@mms/shared";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { Input } from "@/components/ui/input";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { JournalEntryCurrencyState } from "../hooks/useJournalEntryCurrency";
import { functionalPreview } from "../lib/journalEntryCurrency";

interface JournalEntryCurrencyFieldsProps {
  t: TranslationFunction;
  fx: JournalEntryCurrencyState;
  total: number;
  error?: string;
}

/** Transaction currency + exchange rate for a journal entry (IAS 21 spot rate on the date). */
export function JournalEntryCurrencyFields({
  t,
  fx,
  total,
  error,
}: JournalEntryCurrencyFieldsProps): React.JSX.Element | null {
  if (!fx.showCurrencyPicker) return null;
  const preview = functionalPreview(total, fx.currency, fx.functionalCurrency, fx.rate);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Field id="je-currency" label={t("accounting.journal.form.currency")}>
        <FormSelect
          id="je-currency"
          name="currency"
          value={fx.currency}
          onChange={fx.setCurrency}
          options={fx.currencyOptions}
        />
      </Field>
      {fx.isForeign && (
        <>
          <Field
            id="je-exchange-rate"
            label={t("accounting.journal.form.exchangeRate")}
            hint={t("accounting.journal.form.rateHint", {
              functional: fx.functionalCurrency,
              currency: fx.currency,
            })}
            error={error ?? (fx.rateMissing ? t("accounting.journal.form.rateMissing") : undefined)}
            errorId="je-exchange-rate-error"
            required
          >
            <Input
              id="je-exchange-rate"
              name="exchangeRate"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={fx.rate}
              onChange={(event) => fx.setRateOverride(event.target.value)}
              placeholder={fx.lookedUpRate?.rate ?? "0.00"}
              className="text-end font-mono"
            />
          </Field>
          <div className="flex flex-col justify-end pb-2" role="status" aria-live="polite">
            <span className="text-xs text-muted-foreground">
              {t("accounting.journal.form.functionalEquivalent")}
            </span>
            <span className="font-mono text-sm font-semibold">
              {preview === null ? "—" : formatMoney(preview, fx.functionalCurrency, { useSymbol: true })}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
