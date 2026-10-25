import type React from "react";
import { TrendingUp } from "lucide-react";
import { formatDate, type Account, type PriceIndexPoint } from "@mms/shared";
import { DatePicker } from "@/components/app/DatePicker";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { SectionCard } from "@/components/app/SectionCard";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { useHyperinflationPanel } from "@/tenant/features/accounting/hooks/useHyperinflationPanel";
import { accountOptions } from "@/tenant/features/accounting/lib/accountOptions";
import { AccountingSettingsIas29RunsPanel } from "./AccountingSettingsIas29RunsPanel";

type IndexRow = PriceIndexPoint & { id: string };

interface AccountingSettingsHyperinflationSectionProps {
  accounts: Account[];
  canEditSetup: boolean;
}

/** IAS 29: hyperinflationary functional currency — settings, general price index and restatement runs. */
export function AccountingSettingsHyperinflationSection({
  accounts,
  canEditSetup,
}: AccountingSettingsHyperinflationSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const panel = useHyperinflationPanel();
  const { settings } = panel;

  const indexColumns: DataTableColumn<IndexRow>[] = [
    { id: "date", label: t("accounting.settings.ias29.indexDate"), fixed: true, render: (row) => formatDate(row.indexDate) },
    {
      id: "value",
      label: t("accounting.settings.ias29.indexValue"),
      render: (row) => <span className="font-mono">{row.value}</span>,
    },
    { id: "source", label: t("accounting.settings.ias29.indexSource"), hideInCard: true, render: (row) => row.source },
  ];

  return (
    <SectionCard title={t("accounting.settings.secIas29")} icon={TrendingUp} className={SETUP_SECTION_CARD_CLASS}>
      <p className="m-0 mb-3 text-xs text-muted-foreground text-pretty">{t("accounting.settings.ias29.hint")}</p>
      {panel.settingsError ? (
        <ErrorState
          compact
          description={t("accounting.settings.ias29.loadFailed")}
          onRetry={() => void panel.refetchSettings()}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="ias29-enabled" label={t("accounting.settings.ias29.enabled")}>
            <Switch
              id="ias29-enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) => panel.update("enabled", checked)}
              disabled={!canEditSetup}
            />
          </Field>
          <Field
            id="ias29-nmp-account"
            label={t("accounting.settings.ias29.netMonetaryAccount")}
            hint={t("accounting.settings.ias29.netMonetaryAccountHint")}
          >
            <FormSelect
              id="ias29-nmp-account"
              name="netMonetaryAccountId"
              value={settings.netMonetaryAccountId ?? ""}
              onChange={(value) => panel.update("netMonetaryAccountId", value || null)}
              placeholder={t("accounting.journal.form.none")}
              options={accountOptions(accounts, ["Revenue", "Expense"])}
              disabled={!canEditSetup}
            />
          </Field>
          <Field id="ias29-applies-from" label={t("accounting.settings.ias29.appliesFrom")}>
            <DatePicker
              id="ias29-applies-from"
              name="appliesFrom"
              value={settings.appliesFrom ?? ""}
              onChange={(value) => panel.update("appliesFrom", value || null)}
              disabled={!canEditSetup}
            />
          </Field>
          <Field id="ias29-index-name" label={t("accounting.settings.ias29.indexName")}>
            <Input
              id="ias29-index-name"
              name="indexName"
              value={settings.indexName}
              onChange={(event) => panel.update("indexName", event.target.value)}
              disabled={!canEditSetup}
            />
          </Field>
        </div>
      )}
      {canEditSetup && (
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            className="min-h-11"
            onClick={() => void panel.handleSaveSettings()}
            disabled={!panel.settingsDirty || panel.savingSettings}
          >
            {t("accounting.settings.ias29.save")}
          </Button>
        </div>
      )}

      <div className="mt-6 space-y-3 border-t border-border pt-4">
        <h3 className="m-0 text-sm font-semibold text-balance">{t("accounting.settings.ias29.indexTitle")}</h3>
        {canEditSetup && (
          <div className="flex flex-wrap items-end gap-3">
            <Field id="ias29-index-date" label={t("accounting.settings.ias29.indexDate")}>
              <DatePicker id="ias29-index-date" name="indexDate" value={panel.indexDate} onChange={panel.setIndexDate} />
            </Field>
            <Field id="ias29-index-value" label={t("accounting.settings.ias29.indexValue")}>
              <Input
                id="ias29-index-value"
                name="indexValue"
                inputMode="decimal"
                value={panel.indexValue}
                onChange={(event) => panel.setIndexValue(event.target.value)}
              />
            </Field>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => void panel.handleAddIndex()}
              disabled={!panel.indexValue.trim() || panel.savingIndex}
            >
              {t("accounting.settings.ias29.addIndex")}
            </Button>
          </div>
        )}
        <DataTable
          tableId="accounting.priceIndices"
          label={t("accounting.settings.ias29.indexTitle")}
          data={panel.indices.toReversed().map((point) => ({ ...point, id: point.indexDate }))}
          columns={indexColumns}
          isLoading={panel.indicesLoading}
          card={{ title: (row) => formatDate(row.indexDate) }}
          emptyState={<EmptyState title={t("accounting.settings.ias29.noIndices")} />}
        />
      </div>

      <AccountingSettingsIas29RunsPanel panel={panel} canEditSetup={canEditSetup} />
    </SectionCard>
  );
}
