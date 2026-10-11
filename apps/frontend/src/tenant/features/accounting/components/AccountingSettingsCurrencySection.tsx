import type React from "react";
import { type AccountingSettings } from "@mms/shared";
import { DollarSign } from "lucide-react";
import { FormSelect } from "@/components/ui/FormSelect";
import { useTranslation } from "@/hooks/useTranslation";
import { SectionCard } from "@/components/ui/SectionCard";
import { ModuleSetupSaveFooter } from "@/components/ui/ModuleSetupSaveFooter";
import { Field } from "@/components/ui/FormPrimitives";
import { SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { DATE_FORMATS } from "./accountingSettingsPreferencesShared";

type CurrencyOption = {
  code: string;
  symbol: string;
  name: string;
};

export interface AccountingSettingsCurrencySectionProps {
  settingsDraft: AccountingSettings;
  upd: <K extends keyof AccountingSettings>(field: K, value: AccountingSettings[K]) => void;
  currencies: CurrencyOption[];
  activeCurrency: CurrencyOption | undefined;
  decimalSeparators: { label: string; value: string }[];
  isPrefsDirty?: boolean;
  saving?: boolean;
  saved?: boolean;
  onSave?: () => void | Promise<void>;
}

export function AccountingSettingsCurrencySection({
  settingsDraft,
  upd,
  currencies,
  activeCurrency,
  decimalSeparators,
  isPrefsDirty,
  saving,
  saved,
  onSave,
}: AccountingSettingsCurrencySectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <SectionCard
      title={t("accounting.settings.secCurrency")}
      icon={DollarSign}
      className={SETUP_SECTION_CARD_CLASS}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          id="accounting-base-currency"
          label={t("accounting.settings.fields.baseCurrency")}
          hint={t("accounting.settings.fields.baseCurrencyHint")}
        >
          <FormSelect
            id="accounting-base-currency"
            name="currency"
            value={settingsDraft.currency}
            onChange={(currencyValue) => {
              const selectedCurrency = currencies.find(
                (currencyOption) => currencyOption.code === currencyValue,
              );
              upd("currency", currencyValue);
              if (selectedCurrency) upd("currencySymbol", selectedCurrency.symbol);
            }}
            options={currencies.map((currencyOption) => ({
              value: currencyOption.code,
              label: `${currencyOption.symbol} ${currencyOption.code} – ${currencyOption.name}`,
            }))}
          />
          {activeCurrency && (
            <p className="text-xs text-muted-foreground mt-1 m-0">
              {t("accounting.settings.fields.symbol")}:{" "}
              <span className="font-bold">{activeCurrency.symbol}</span> ·{" "}
              {t("accounting.settings.fields.code")}:{" "}
              <span className="font-mono font-bold">{activeCurrency.code}</span>
            </p>
          )}
        </Field>

        <Field id="accounting-date-format" label={t("accounting.settings.fields.dateFormat")}>
          <FormSelect
            id="accounting-date-format"
            name="dateFormat"
            value={settingsDraft.dateFormat}
            onChange={(dateFormatValue) => upd("dateFormat", dateFormatValue)}
            options={DATE_FORMATS}
          />
        </Field>

        <Field
          id="accounting-decimal-separator"
          label={t("accounting.settings.fields.numberFormat")}
        >
          <FormSelect
            id="accounting-decimal-separator"
            name="decimalSeparator"
            value={settingsDraft.decimalSeparator}
            onChange={(separatorValue) =>
              upd("decimalSeparator", separatorValue as AccountingSettings["decimalSeparator"])
            }
            options={decimalSeparators}
          />
        </Field>

        <Field id="accounting-decimal-places" label={t("accounting.settings.fields.decimalPlaces")}>
          <FormSelect
            id="accounting-decimal-places"
            name="decimalPlaces"
            value={String(settingsDraft.decimalPlaces ?? 2)}
            onChange={(decimalPlacesValue) => upd("decimalPlaces", parseInt(decimalPlacesValue))}
            options={[0, 1, 2, 3].map((placeCount) => String(placeCount))}
            className="w-full sm:w-32"
          />
        </Field>
      </div>

      <ModuleSetupSaveFooter
        dirty={Boolean(isPrefsDirty)}
        saving={Boolean(saving)}
        saved={Boolean(saved)}
        saveLabel={saving ? t("global.saving") : t("common.save")}
        savedLabel={t("settings.savedBadge")}
        onSave={onSave ?? (() => {})}
        disableUnsavedGuard
        footerClassName="mt-4 pt-3"
      />
    </SectionCard>
  );
}
