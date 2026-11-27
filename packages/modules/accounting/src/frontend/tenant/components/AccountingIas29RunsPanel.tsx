import type React from "react";
import { formatDate, formatMoney, type Ias29Run } from "@mms/contracts";
import { DatePicker } from "@mms/fe-core/components/DatePicker";
import { EmptyState } from "@mms/ui";
import { Field } from "@mms/ui";
import { DataTable, type DataTableColumn } from "@mms/fe-core/components/data-table";
import { Button } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import type { HyperinflationPanel } from "../hooks/useHyperinflationPanel";

type LineRow = Ias29Run["lines"][number] & { id: string };

export interface AccountingIas29RunsPanelProps {
  panel: HyperinflationPanel;
  canEdit: boolean;
}

/** IAS 29 restatement: preview, post with next-day reversal, and history. */
export function AccountingIas29RunsPanel({
  panel,
  canEdit,
}: AccountingIas29RunsPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const money = (value: string) => formatMoney(Number(value), undefined, { useSymbol: true });
  const signed = (value: string) => (
    <span
      className={`font-mono font-semibold ${value.startsWith("-") ? "text-destructive" : "text-success"}`}
    >
      {money(value)}
    </span>
  );

  const lineColumns: DataTableColumn<LineRow>[] = [
    {
      id: "account",
      kind: "title",
      label: t("accounting.settings.fxReval.account"),
      fixed: true,
      render: (row) => `${row.accountCode} – ${row.accountName}`,
    },
    {
      id: "carrying",
      kind: "money",
      label: t("accounting.settings.ias29.historical"),
      hideInCard: true,
      render: (row) => <span className="font-mono">{money(row.carrying)}</span>,
    },
    {
      id: "restated",
      kind: "money",
      label: t("accounting.settings.ias29.restated"),
      render: (row) => <span className="font-mono">{money(row.restated)}</span>,
    },
    {
      id: "adjustment",
      kind: "money",
      label: t("accounting.settings.ias29.adjustment"),
      render: (row) => <span className="font-mono">{money(row.adjustment)}</span>,
    },
  ];

  const runColumns: DataTableColumn<Ias29Run>[] = [
    {
      id: "date",
      kind: "date",
      label: t("accounting.settings.ias29.date"),
      fixed: true,
      render: (run) => formatDate(run.restatementDate),
    },
    {
      id: "index",
      kind: "number",
      label: t("accounting.settings.ias29.closingIndex"),
      render: (run) => run.closingIndex,
    },
    {
      id: "result",
      kind: "status",
      label: t("accounting.settings.ias29.monetaryResult"),
      render: (run) => signed(run.netMonetaryResult),
    },
  ];

  return (
    <div className="mt-6 space-y-3 border-t border-border pt-4">
      <h3 className="m-0 text-sm font-semibold text-balance">
        {t("accounting.settings.ias29.runTitle")}
      </h3>
      <div className="flex flex-wrap items-end gap-3">
        <Field id="ias29-date" label={t("accounting.settings.ias29.date")}>
          <DatePicker
            id="ias29-date"
            name="restatementDate"
            value={panel.restatementDate}
            onChange={panel.setRestatementDate}
          />
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
        {canEdit && panel.previewRun && (
          <Button
            type="button"
            className="min-h-11"
            onClick={() => void panel.handlePost()}
            disabled={panel.posting || panel.alreadyPosted}
          >
            {panel.alreadyPosted
              ? t("accounting.settings.fxReval.alreadyPosted")
              : t("accounting.settings.ias29.post")}
          </Button>
        )}
      </div>

      {panel.previewRun && (
        <div className="space-y-2" role="status" aria-live="polite">
          <p className="m-0 text-sm font-semibold">
            {t("accounting.settings.ias29.previewTotal", {
              amount: money(panel.previewRun.netMonetaryResult),
            })}
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
        label={t("accounting.settings.ias29.history")}
        data={panel.runs}
        columns={runColumns}
        isLoading={panel.runsLoading}
        card={{ title: (run) => formatDate(run.restatementDate) }}
        emptyState={<EmptyState title={t("accounting.settings.ias29.noRuns")} />}
      />
    </div>
  );
}
