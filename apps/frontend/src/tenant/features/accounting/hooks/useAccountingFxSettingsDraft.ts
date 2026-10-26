import { useEffect, useMemo, useState } from "react";
import { ISO_4217_CURRENCIES, isSupportedFunctionalCurrency } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  useAccountingCurrencySettings,
  useSaveAccountingCurrencySettings,
} from "@/tenant/features/accounting/hooks/useAccountingFx";

interface FxSettingsDraft {
  functionalCurrency: string;
  presentationCurrency: string;
  enabledCurrencies: string[];
}

const EMPTY_DRAFT: FxSettingsDraft = {
  functionalCurrency: "",
  presentationCurrency: "",
  enabledCurrencies: [],
};

const sameDraft = (left: FxSettingsDraft, right: FxSettingsDraft): boolean =>
  left.functionalCurrency === right.functionalCurrency &&
  left.presentationCurrency === right.presentationCurrency &&
  left.enabledCurrencies.toSorted().join() === right.enabledCurrencies.toSorted().join();

/** Draft state and dirty-gated save for Setup → Currencies & exchange rates. */
export function useAccountingFxSettingsDraft() {
  const { t } = useTranslation();
  const query = useAccountingCurrencySettings();
  const save = useSaveAccountingCurrencySettings();
  const [draft, setDraft] = useState<FxSettingsDraft>(EMPTY_DRAFT);

  const loaded = useMemo<FxSettingsDraft>(
    () =>
      query.data
        ? {
            functionalCurrency: query.data.functionalCurrency,
            presentationCurrency: query.data.presentationCurrency,
            enabledCurrencies: query.data.enabledCurrencies,
          }
        : EMPTY_DRAFT,
    [query.data],
  );

  useEffect(() => setDraft(loaded), [loaded]);

  const currencyCodes = useMemo(() => ISO_4217_CURRENCIES.map((currency) => currency.code), []);
  const currencyOptions = useMemo(
    () =>
      ISO_4217_CURRENCIES.map((currency) => ({
        value: currency.code,
        label: `${currency.code} – ${currency.name}`,
      })),
    [],
  );
  const functionalOptions = useMemo(
    () => currencyOptions.filter((option) => isSupportedFunctionalCurrency(option.value)),
    [currencyOptions],
  );

  const handleSave = async (): Promise<void> => {
    try {
      await save.mutateAsync({
        ...draft,
        enabledCurrencies: draft.enabledCurrencies.filter(
          (code) => code !== draft.functionalCurrency,
        ),
      });
      notify.success(t("accounting.settings.fx.saved"));
    } catch (error) {
      notify.error(t("accounting.settings.fx.saveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return {
    draft,
    setDraft,
    locked: query.data?.locked ?? false,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    dirty: Boolean(query.data) && !sameDraft(draft, loaded),
    saving: save.isPending,
    handleSave,
    currencyCodes,
    currencyOptions,
    functionalOptions,
  };
}
