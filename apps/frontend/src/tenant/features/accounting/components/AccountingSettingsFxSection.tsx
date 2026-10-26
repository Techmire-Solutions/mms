import type React from "react";
import { Globe2 } from "lucide-react";
import { ErrorState } from "@/components/app/ErrorState";
import { EditableMultiSelect } from "@/components/app/EditableMultiSelect";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { ModuleSetupSaveFooter } from "@/components/app/ModuleSetupSaveFooter";
import { SectionCard } from "@/components/app/SectionCard";
import { Alert } from "@/components/app/Alert";
import { SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { useAccountingFxSettingsDraft } from "@/tenant/features/accounting/hooks/useAccountingFxSettingsDraft";
import { AccountingSettingsExchangeabilitySection } from "./AccountingSettingsExchangeabilitySection";

interface AccountingSettingsFxSectionProps {
  canEditSetup: boolean;
}

/** IAS 21 functional / presentation currency, enabled currencies and the rate table. */
export function AccountingSettingsFxSection({
  canEditSetup,
}: AccountingSettingsFxSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const fx = useAccountingFxSettingsDraft();
  const readOnly = !canEditSetup;

  return (
    <SectionCard
      title={t("accounting.settings.secFx")}
      icon={Globe2}
      className={SETUP_SECTION_CARD_CLASS}
    >
      <p className="m-0 mb-3 text-xs text-muted-foreground text-pretty">
        {t("accounting.settings.fx.hint")}
      </p>

      {fx.isError ? (
        <ErrorState
          compact
          description={t("accounting.settings.fx.loadFailed")}
          onRetry={() => void fx.refetch()}
        />
      ) : (
        <>
          {fx.locked && (
            <Alert tone="info" description={t("accounting.settings.fx.functionalLockedHint")} />
          )}
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="accounting-functional-currency"
              label={t("accounting.settings.fx.functionalCurrency")}
              hint={t("accounting.settings.fx.functionalCurrencyHint")}
            >
              <FormSelect
                id="accounting-functional-currency"
                name="functionalCurrency"
                value={fx.draft.functionalCurrency}
                onChange={(value) =>
                  fx.setDraft((current) => ({ ...current, functionalCurrency: value }))
                }
                options={fx.functionalOptions}
                searchable
                disabled={readOnly || fx.locked || fx.isLoading}
              />
            </Field>
            <Field
              id="accounting-presentation-currency"
              label={t("accounting.settings.fx.presentationCurrency")}
              hint={t("accounting.settings.fx.presentationCurrencyHint")}
            >
              <FormSelect
                id="accounting-presentation-currency"
                name="presentationCurrency"
                value={fx.draft.presentationCurrency}
                onChange={(value) =>
                  fx.setDraft((current) => ({ ...current, presentationCurrency: value }))
                }
                options={fx.currencyOptions}
                searchable
                disabled={readOnly || fx.isLoading}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field
                id="accounting-enabled-currencies"
                label={t("accounting.settings.fx.enabledCurrencies")}
                hint={t("accounting.settings.fx.enabledCurrenciesHint")}
              >
                {readOnly ? (
                  <p id="accounting-enabled-currencies" className="m-0 font-mono text-sm">
                    {fx.draft.enabledCurrencies.join(", ") || "—"}
                  </p>
                ) : (
                  <EditableMultiSelect
                    id="accounting-enabled-currencies"
                    name="enabledCurrencies"
                    options={fx.currencyCodes.filter(
                      (code) => code !== fx.draft.functionalCurrency,
                    )}
                    values={fx.draft.enabledCurrencies}
                    onChange={(values) =>
                      fx.setDraft((current) => ({ ...current, enabledCurrencies: values }))
                    }
                    placeholder={t("accounting.settings.fx.enabledCurrenciesPlaceholder")}
                  />
                )}
              </Field>
            </div>
          </div>
          {canEditSetup && (
            <ModuleSetupSaveFooter
              dirty={fx.dirty}
              saving={fx.saving}
              saved={false}
              saveLabel={fx.saving ? t("global.saving") : t("common.save")}
              savedLabel={t("settings.savedBadge")}
              onSave={fx.handleSave}
              disableUnsavedGuard
              footerClassName="mt-4 pt-3"
            />
          )}
        </>
      )}

      <AccountingSettingsExchangeabilitySection
        enabledCurrencies={fx.draft.enabledCurrencies}
        canEditSetup={canEditSetup}
      />
    </SectionCard>
  );
}
