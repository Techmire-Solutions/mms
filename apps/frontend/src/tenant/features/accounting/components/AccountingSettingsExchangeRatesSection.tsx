import type React from "react";
import { ArrowLeftRight } from "lucide-react";
import {
  ESTIMATED_RATE_SOURCE,
  EXCHANGE_RATE_TYPES,
  formatDate,
  type ExchangeRateRecord,
} from "@mms/shared";
import { DatePicker } from "@/components/app/DatePicker";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { Field, FieldErrorMessage } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { SectionCard } from "@/components/app/SectionCard";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { useExchangeRateDraft } from "@/tenant/features/accounting/hooks/useExchangeRateDraft";

export interface AccountingSettingsExchangeRatesSectionProps {
  functionalCurrency: string;
  enabledCurrencies: string[];
  canEdit?: boolean;
}

/** Manual exchange rates: add or override a rate, and the rate history table. */
export function AccountingSettingsExchangeRatesSection({
  functionalCurrency,
  enabledCurrencies,
  canEdit = true,
}: AccountingSettingsExchangeRatesSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const rates = useExchangeRateDraft(functionalCurrency, enabledCurrencies);
  const currencyOptions = [functionalCurrency, ...enabledCurrencies]
    .filter(Boolean)
    .map((code) => ({ value: code, label: code }));
  const typeOptions = EXCHANGE_RATE_TYPES.map((type) => ({
    value: type,
    label: t(`accounting.settings.fx.rateType.${type}`),
  }));

  const columns: DataTableColumn<ExchangeRateRecord>[] = [
    {
      id: "rateDate",
      label: t("accounting.settings.fx.rates.date"),
      fixed: true,
      searchValue: (row) => formatDate(row.rateDate),
      render: (row) => formatDate(row.rateDate),
    },
    {
      id: "pair",
      label: t("accounting.settings.fx.rates.pair"),
      searchValue: (row) => `${row.fromCurrency} ${row.toCurrency}`,
      render: (row) => (
        <span className="font-mono">
          1 {row.fromCurrency} = {row.rate} {row.toCurrency}
          {row.source === ESTIMATED_RATE_SOURCE && (
            <span className="ms-2 rounded-sm bg-warning/10 px-1.5 py-0.5 font-sans text-3xs font-semibold text-warning">
              {t("accounting.settings.fx.rates.estimate")}
            </span>
          )}
        </span>
      ),
    },
    {
      id: "rateType",
      label: t("accounting.settings.fx.rates.type"),
      render: (row) => t(`accounting.settings.fx.rateType.${row.rateType}`),
    },
    {
      id: "reason",
      label: t("accounting.settings.fx.rates.reason"),
      hideInCard: true,
      render: (row) => <span className="text-muted-foreground">{row.overrideReason || "—"}</span>,
    },
  ];

  return (
    <SectionCard
      title={t("accounting.settings.fx.rates.title")}
      icon={ArrowLeftRight}
      className={SETUP_SECTION_CARD_CLASS}
    >
      <p className="m-0 mb-3 text-xs text-muted-foreground text-pretty">
        {t("accounting.settings.fx.rates.hint", { currency: functionalCurrency })}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Field id="fx-rate-from" label={t("accounting.settings.fx.rates.from")}>
          <FormSelect
            id="fx-rate-from"
            name="fromCurrency"
            value={rates.draft.fromCurrency}
            onChange={(value) => rates.setDraft((d) => ({ ...d, fromCurrency: value }))}
            options={currencyOptions}
          />
        </Field>
        <Field id="fx-rate-to" label={t("accounting.settings.fx.rates.to")}>
          <FormSelect
            id="fx-rate-to"
            name="toCurrency"
            value={rates.draft.toCurrency}
            onChange={(value) => rates.setDraft((d) => ({ ...d, toCurrency: value }))}
            options={currencyOptions}
          />
        </Field>
        <Field id="fx-rate-date" label={t("accounting.settings.fx.rates.date")}>
          <DatePicker
            id="fx-rate-date"
            name="rateDate"
            value={rates.draft.rateDate}
            onChange={(value) => rates.setDraft((d) => ({ ...d, rateDate: value }))}
          />
        </Field>
        <Field id="fx-rate-type" label={t("accounting.settings.fx.rates.type")}>
          <FormSelect
            id="fx-rate-type"
            name="rateType"
            value={rates.draft.rateType}
            onChange={(value) =>
              rates.setDraft((d) => ({ ...d, rateType: value as typeof d.rateType }))
            }
            options={typeOptions}
          />
        </Field>
        <Field id="fx-rate-value" label={t("accounting.settings.fx.rates.rate")}>
          <Input
            id="fx-rate-value"
            name="rate"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={rates.draft.rate}
            onChange={(event) => rates.setDraft((d) => ({ ...d, rate: event.target.value }))}
            placeholder="280.50"
            className="text-end font-mono"
          />
        </Field>
        <Field
          id="fx-rate-reason"
          label={t("accounting.settings.fx.rates.reason")}
          required={rates.overriding}
        >
          <Input
            id="fx-rate-reason"
            name="overrideReason"
            value={rates.draft.overrideReason}
            onChange={(event) =>
              rates.setDraft((d) => ({ ...d, overrideReason: event.target.value }))
            }
            placeholder={t("accounting.settings.fx.rates.reasonPlaceholder")}
          />
        </Field>
      </div>
      <FieldErrorMessage message={rates.error ?? undefined} className="m-0" />
      {canEdit && (
        <Button
          type="button"
          className="min-h-11"
          onClick={() => void rates.handleSave()}
          disabled={rates.saving || enabledCurrencies.length === 0}
        >
          {rates.overriding
            ? t("accounting.settings.fx.rates.override")
            : t("accounting.settings.fx.rates.add")}
        </Button>
      )}

      {rates.isError ? (
        <ErrorState
          compact
          description={t("accounting.settings.fx.rates.loadFailed")}
          onRetry={() => void rates.refetch()}
        />
      ) : (
        <DataTable
          tableId="accounting.exchangeRates"
          label={t("accounting.settings.fx.rates.title")}
          data={rates.rates}
          columns={columns}
          isLoading={rates.isLoading}
          card={{ title: (row) => `${row.fromCurrency} → ${row.toCurrency}` }}
          emptyState={
            <EmptyState
              title={t("accounting.settings.fx.rates.emptyTitle")}
              description={t("accounting.settings.fx.rates.emptyDescription")}
            />
          }
        />
      )}
    </SectionCard>
  );
}
