import type React from "react";
import { Ban } from "lucide-react";
import { DatePicker } from "@/components/app/DatePicker";
import { ErrorState } from "@/components/app/ErrorState";
import { FormCollectionShell } from "@/components/app/FormCollectionShell";
import { FormListFieldCard } from "@/components/app/FormListFieldCard";
import { Field, FieldErrorMessage } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/useTranslation";
import { useExchangeabilityDraft } from "@/tenant/features/accounting/hooks/useExchangeabilityDraft";

interface AccountingSettingsExchangeabilitySectionProps {
  enabledCurrencies: string[];
  canEditSetup: boolean;
}

/** IAS 21 (2025): currencies that cannot be exchanged, with the estimation approach disclosed. */
export function AccountingSettingsExchangeabilitySection({
  enabledCurrencies,
  canEditSetup,
}: AccountingSettingsExchangeabilitySectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const draft = useExchangeabilityDraft();
  const currencyOptions = enabledCurrencies.map((code) => ({ value: code, label: code }));

  return (
    <div className="mt-6 space-y-3 border-t border-border pt-4">
      <h3 className="m-0 flex items-center gap-2 text-sm font-semibold text-balance">
        <Ban className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        {t("accounting.settings.fx.exchangeability.title")}
      </h3>
      <p className="m-0 text-xs text-muted-foreground text-pretty">
        {t("accounting.settings.fx.exchangeability.hint")}
      </p>
      {draft.isError ? (
        <ErrorState
          compact
          description={t("accounting.settings.fx.exchangeability.loadFailed")}
          onRetry={() => void draft.refetch()}
        />
      ) : (
        <FormCollectionShell
          isEmpty={draft.rows.length === 0}
          emptyMessage={t("accounting.settings.fx.exchangeability.empty")}
          addLabel={t("accounting.settings.fx.exchangeability.add")}
          onAdd={draft.addRow}
          allowAdd={canEditSetup && enabledCurrencies.length > 0}
        >
          {draft.rows.map((row, index) => {
            const id = `exch-${row.key}`;
            return (
              <FormListFieldCard
                key={row.key}
                id={id}
                index={index}
                label={row.currency || t("accounting.settings.fx.exchangeability.currency")}
                onRemove={() => draft.removeRow(row.key)}
                removeLabel={t("accounting.settings.fx.exchangeability.remove")}
                canRemove={canEditSetup}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field
                    id={`${id}-currency`}
                    label={t("accounting.settings.fx.exchangeability.currency")}
                  >
                    <FormSelect
                      id={`${id}-currency`}
                      name={`currencies.${index}.currency`}
                      value={row.currency}
                      onChange={(value) => draft.updateRow(row.key, { currency: value })}
                      options={currencyOptions}
                      disabled={!canEditSetup}
                    />
                  </Field>
                  <Field
                    id={`${id}-assessed`}
                    label={t("accounting.settings.fx.exchangeability.assessedOn")}
                  >
                    <DatePicker
                      id={`${id}-assessed`}
                      name={`currencies.${index}.assessedOn`}
                      value={row.assessedOn}
                      onChange={(value) => draft.updateRow(row.key, { assessedOn: value })}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field
                      id={`${id}-method`}
                      label={t("accounting.settings.fx.exchangeability.method")}
                      hint={t("accounting.settings.fx.exchangeability.methodHint")}
                      required
                    >
                      <Textarea
                        id={`${id}-method`}
                        name={`currencies.${index}.estimationMethod`}
                        value={row.estimationMethod}
                        onChange={(event) =>
                          draft.updateRow(row.key, { estimationMethod: event.target.value })
                        }
                        disabled={!canEditSetup}
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field
                      id={`${id}-reason`}
                      label={t("accounting.settings.fx.exchangeability.reason")}
                    >
                      <Textarea
                        id={`${id}-reason`}
                        name={`currencies.${index}.reason`}
                        value={row.reason}
                        onChange={(event) =>
                          draft.updateRow(row.key, { reason: event.target.value })
                        }
                        disabled={!canEditSetup}
                      />
                    </Field>
                  </div>
                </div>
              </FormListFieldCard>
            );
          })}
        </FormCollectionShell>
      )}
      <FieldErrorMessage message={draft.error ?? undefined} className="m-0" />
      {canEditSetup && (
        <Button
          type="button"
          className="min-h-11"
          onClick={() => void draft.handleSave()}
          disabled={draft.saving}
        >
          {t("accounting.settings.fx.exchangeability.save")}
        </Button>
      )}
    </div>
  );
}
