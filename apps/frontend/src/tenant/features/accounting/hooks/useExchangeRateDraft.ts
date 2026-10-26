import { useState } from "react";
import {
  exchangeRatePutItemSchema,
  todayISO,
  type ExchangeRateRecord,
  type ExchangeRateType,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  useAccountingExchangeRates,
  useSaveAccountingExchangeRates,
} from "@/tenant/features/accounting/hooks/useAccountingFx";

export interface ExchangeRateDraft {
  fromCurrency: string;
  toCurrency: string;
  rateDate: string;
  rateType: ExchangeRateType;
  rate: string;
  overrideReason: string;
}

/** Rate table data plus the add/override form for Setup → Currencies & exchange rates. */
export function useExchangeRateDraft(functionalCurrency: string, enabledCurrencies: string[]) {
  const { t } = useTranslation();
  const rates = useAccountingExchangeRates();
  const save = useSaveAccountingExchangeRates();
  const [draft, setDraft] = useState<ExchangeRateDraft>({
    fromCurrency: "",
    toCurrency: "",
    rateDate: todayISO(),
    rateType: "SPOT",
    rate: "",
    overrideReason: "",
  });
  const [error, setError] = useState<string | null>(null);

  const fromCurrency = draft.fromCurrency || enabledCurrencies[0] || "";
  const toCurrency = draft.toCurrency || functionalCurrency;
  const existing = (rates.data ?? []).find(
    (row: ExchangeRateRecord) =>
      row.fromCurrency === fromCurrency &&
      row.toCurrency === toCurrency &&
      row.rateDate === draft.rateDate &&
      row.rateType === draft.rateType,
  );

  const handleSave = async (): Promise<void> => {
    const parsed = exchangeRatePutItemSchema.safeParse({
      ...draft,
      fromCurrency,
      toCurrency,
      rate: draft.rate.trim(),
      overrideReason: draft.overrideReason.trim() || undefined,
    });
    if (!parsed.success) {
      setError(t("accounting.settings.fx.rates.invalid"));
      return;
    }
    if (existing && !draft.overrideReason.trim()) {
      setError(t("accounting.settings.fx.rates.overrideReasonRequired"));
      return;
    }
    setError(null);
    try {
      await save.mutateAsync([parsed.data]);
      setDraft((current) => ({ ...current, rate: "", overrideReason: "" }));
      notify.success(t("accounting.settings.fx.rates.saved"));
    } catch (saveError) {
      notify.error(t("accounting.settings.fx.rates.saveFailed"), {
        description: saveError instanceof Error ? saveError.message : String(saveError),
      });
    }
  };

  return {
    draft: { ...draft, fromCurrency, toCurrency },
    setDraft,
    error,
    overriding: Boolean(existing),
    rates: rates.data ?? [],
    isLoading: rates.isPending,
    isError: rates.isError,
    refetch: rates.refetch,
    saving: save.isPending,
    handleSave,
  };
}
