import type React from "react";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { Input } from "@/components/ui/input";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

/** The slice of document-currency state this presentational component renders. */
export interface DocumentCurrencyFieldsState {
  functionalCurrency: string;
  currency: string;
  setCurrency: (currency: string) => void;
  rateCurrency: string | null;
  needsRate: boolean;
  rate: string;
  setRateOverride: (rate: string) => void;
  lookedUpRate: { rate: string } | null;
  rateMissing: boolean;
  currencyOptions: { value: string; label: string }[];
  showCurrencyPicker: boolean;
}

interface DocumentCurrencyFieldsProps {
  t: TranslationFunction;
  idPrefix: string;
  fx: DocumentCurrencyFieldsState;
  /** Pre-formatted equivalent shown beside the rate (functional total, applied amount…). */
  preview?: { label: string; value: string };
  error?: string;
  /** Lock the currency (e.g. an edited document whose currency is fixed). */
  currencyDisabled?: boolean;
}

/** Currency picker + exchange-rate field shared by journal, invoice and payment forms. */
export function DocumentCurrencyFields({
  t,
  idPrefix,
  fx,
  preview,
  error,
  currencyDisabled = false,
}: DocumentCurrencyFieldsProps): React.JSX.Element | null {
  if (!fx.showCurrencyPicker) return null;
  const rateId = `${idPrefix}-exchange-rate`;
  const needsRate = fx.needsRate;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Field id={`${idPrefix}-currency`} label={t("fx.field.currency")}>
        <FormSelect
          id={`${idPrefix}-currency`}
          name="currency"
          value={fx.currency}
          onChange={fx.setCurrency}
          options={fx.currencyOptions}
          disabled={currencyDisabled}
        />
      </Field>
      {needsRate && (
        <Field
          id={rateId}
          label={t("fx.field.exchangeRate")}
          hint={t("fx.field.rateHint", {
            functional: fx.functionalCurrency,
            currency: fx.rateCurrency ?? fx.currency,
          })}
          error={error ?? (fx.rateMissing ? t("fx.field.rateMissing") : undefined)}
          errorId={`${rateId}-error`}
          required
        >
          <Input
            id={rateId}
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
      )}
      {needsRate && preview && (
        <div className="flex flex-col justify-end pb-2" role="status" aria-live="polite">
          <span className="text-xs text-muted-foreground">{preview.label}</span>
          <span className="font-mono text-sm font-semibold">{preview.value}</span>
        </div>
      )}
    </div>
  );
}
