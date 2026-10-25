import type React from "react";
import { formatDate, formatMoney, type Ias29Run } from "@mms/shared";
import { DatePicker } from "@/components/app/DatePicker";
import { EmptyState } from "@/components/app/EmptyState";
import { Field } from "@/components/app/FormPrimitives";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import type { HyperinflationPanel } from "@/tenant/features/accounting/hooks/useHyperinflationPanel";

type LineRow = Ias29Run["lines"][number] & { id: string };

interface AccountingSettingsIas29RunsPanelProps {
  panel: HyperinflationPanel;
  canEditSetup: boolean;
}

/** IAS 29 restatement: preview, post with next-day reversal, and history. */
export function AccountingSettingsIas29RunsPanel({
  panel,
  canEditSetup,
}: AccountingSettingsIas29RunsPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const money = (value: string) => formatMoney(Number(value));
  const signed = (value: string) => (
    <span className={`font-mono font-semibold ${value.startsWith("-") ? "text-destructive" : "text-success"}`}>
      {money(value)}
    </span>
  );

  const lineColumns: DataTableColumn<LineRow>[] = [
    {
      id: "account",
      label: t("accounting.settings.fxReval.account"),
      fixed: true,
      render: (row) => `${row.accountCode} – ${row.accountName}`,
    },
    {
      id: "carrying",
      label: t("accounting.settings.ias29.historical"),
      hideInCard: true,
      render: (row) => <span className="font-mono">{money(row.carrying)}</span>,
    },
    {
      id: "restated",
      label: t("accounting.settings.ias29.restated"),
      render: (row) => <span className="font-mono">{money(row.restated)}</span>,
    },
    { id: "adjustment", label: t("accounting.settings.ias29.adjustment"), render: (row) => signed(row.adjustment) },
  ];

  const runColumns: DataTableColumn<Ias29Run>[] = [
    { id: "date", label: t("accounting.settings.ias29.date"), fixed: true, render: (run) => formatDate(run.restatementDate) },
    { id: "index", label: t("accounting.settings.ias29.closingIndex"), render: (run) => run.closingIndex },
    { id: "result", label: t("accounting.settings.ias29.monetaryResult"), render: (run) => signed(run.netMonetaryResult) },
  ];

  return (
    <div className="mt-6 space-y-3 border-t border-border pt-4">
      <h3 className="m-0 text-sm font-semibold text-balance">{t("accounting.settings.ias29.runTitle")}</h3>
      <div className="flex flex-wrap items-end gap-3">
        <Field id="ias29-date" label={t("accounting.settings.ias29.date")}>
          <DatePicker id="ias29-date" name="restatementDate" value={panel.restatementDate} onChange={panel.setRestatementDate} />
        </Field>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => void panel.handlePreview()}
          disabled={panel.previewing || !panel.settings.enabled}
        >
          {t("accounting.settings.fxReval.preview")}
        </Button>
        {canEditSetup && panel.previewRun && (
          <Button
            type="button"
            className="min-h-11"
            onClick={() => void panel.handlePost()}
            disabled={panel.posting || panel.alreadyPosted}
          >
            {panel.alreadyPosted ? t("accounting.settings.fxReval.alreadyPosted") : t("accounting.settings.ias29.post")}
          </Button>
        )}
      </div>

      {panel.previewRun && (
        <div className="space-y-2" role="status" aria-live="polite">
          <p className="m-0 text-sm font-semibold">
            {t("accounting.settings.ias29.previewTotal", { amount: money(panel.previewRun.netMonetaryResult) })}
          </p>
          <DataTable
            tableId="accounting.ias29Preview"
            label={t("accounting.settings.ias29.runTitle")}
            data={panel.previewRun.lines.map((line) => ({ ...line, id: line.accountId }))}
            columns={lineColumns}
            card={{ title: (row) => row.accountName }}
            emptyState={<EmptyState title={t("accounting.settings.ias29.nothingToRestate")} />}
          />
        </div>
      )}

      <DataTable
        tableId="accounting.ias29Runs"
        label={t("accounting.settings.fxReval.history")}
        data={panel.runs}
        columns={runColumns}
        isLoading={panel.runsLoading}
        card={{ title: (run) => formatDate(run.restatementDate) }}
        emptyState={<EmptyState title={t("accounting.settings.ias29.noRuns")} />}
      />
    </div>
  );
}
