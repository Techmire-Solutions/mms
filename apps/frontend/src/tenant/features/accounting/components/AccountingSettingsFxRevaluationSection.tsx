import type React from "react";
import { Scale } from "lucide-react";
import { formatDate, formatMoney, type FxRevaluationLine, type FxRevaluationRun } from "@mms/shared";
import { DatePicker } from "@/components/app/DatePicker";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { Field } from "@/components/app/FormPrimitives";
import { SectionCard } from "@/components/app/SectionCard";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { useFxRevaluationPanel } from "@/tenant/features/accounting/hooks/useFxRevaluationPanel";

type LineRow = FxRevaluationLine & { id: string };

interface AccountingSettingsFxRevaluationSectionProps {
  canEditSetup: boolean;
}

/** IAS 21.23 period-end revaluation: preview at closing rates, post with auto-reversal, history. */
export function AccountingSettingsFxRevaluationSection({
  canEditSetup,
}: AccountingSettingsFxRevaluationSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const panel = useFxRevaluationPanel();
  const money = (value: string, currency: string) =>
    formatMoney(Number(value), currency, { useSymbol: true });
  const functional = panel.previewRun?.functionalCurrency ?? panel.runs[0]?.functionalCurrency ?? "";

  const lineColumns: DataTableColumn<LineRow>[] = [
    {
      id: "account",
      label: t("accounting.settings.fxReval.account"),
      fixed: true,
      render: (row) => `${row.accountCode} – ${row.accountName}`,
    },
    {
      id: "open",
      label: t("accounting.settings.fxReval.openBalance"),
      render: (row) => <span className="font-mono">{money(row.openTxn, row.currency)}</span>,
    },
    {
      id: "rate",
      label: t("accounting.settings.fxReval.closingRate"),
      render: (row) => <span className="font-mono">{row.closingRate}</span>,
    },
    {
      id: "carrying",
      label: t("accounting.settings.fxReval.carrying"),
      hideInCard: true,
      render: (row) => <span className="font-mono">{money(row.carryingFunc, functional)}</span>,
    },
    {
      id: "unrealized",
      label: t("accounting.settings.fxReval.unrealized"),
      render: (row) => (
        <span className={`font-mono font-semibold ${row.unrealized.startsWith("-") ? "text-destructive" : "text-success"}`}>
          {money(row.unrealized, functional)}
        </span>
      ),
    },
  ];

  const runColumns: DataTableColumn<FxRevaluationRun>[] = [
    {
      id: "date",
      label: t("accounting.settings.fxReval.date"),
      fixed: true,
      render: (run) => formatDate(run.revaluationDate),
    },
    {
      id: "lines",
      label: t("accounting.settings.fxReval.balances"),
      render: (run) => String(run.lines.length),
    },
    {
      id: "total",
      label: t("accounting.settings.fxReval.unrealized"),
      render: (run) => <span className="font-mono">{money(run.totalUnrealized, run.functionalCurrency)}</span>,
    },
  ];

  return (
    <SectionCard title={t("accounting.settings.secFxReval")} icon={Scale} className={SETUP_SECTION_CARD_CLASS}>
      <p className="m-0 mb-3 text-xs text-muted-foreground text-pretty">
        {t("accounting.settings.fxReval.hint")}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Field id="fx-reval-date" label={t("accounting.settings.fxReval.date")}>
          <DatePicker
            id="fx-reval-date"
            name="revaluationDate"
            value={panel.revaluationDate}
            onChange={panel.setRevaluationDate}
          />
        </Field>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => void panel.handlePreview()}
          disabled={panel.previewing}
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
            {panel.alreadyPosted
              ? t("accounting.settings.fxReval.alreadyPosted")
              : t("accounting.settings.fxReval.post")}
          </Button>
        )}
      </div>

      {panel.previewRun && (
        <div className="mt-4 space-y-2" role="status" aria-live="polite">
          <p className="m-0 text-sm font-semibold">
            {t("accounting.settings.fxReval.previewTotal", {
              amount: money(panel.previewRun.totalUnrealized, panel.previewRun.functionalCurrency),
            })}
          </p>
          <DataTable
            tableId="accounting.fxRevaluationPreview"
            label={t("accounting.settings.fxReval.previewTitle")}
            data={panel.previewRun.lines.map((line, index) => ({ ...line, id: `${line.accountId}-${line.currency}-${index}` }))}
            columns={lineColumns}
            card={{ title: (row) => `${row.accountName} · ${row.currency}` }}
            emptyState={<EmptyState title={t("accounting.settings.fxReval.nothingToRevalue")} />}
          />
        </div>
      )}

      <div className="mt-6 border-t border-border pt-4">
        {panel.runsError ? (
          <ErrorState
            compact
            description={t("accounting.settings.fxReval.loadFailed")}
            onRetry={() => void panel.refetchRuns()}
          />
        ) : (
          <DataTable
            tableId="accounting.fxRevaluationRuns"
            label={t("accounting.settings.fxReval.history")}
            data={panel.runs}
            columns={runColumns}
            isLoading={panel.runsLoading}
            card={{ title: (run) => formatDate(run.revaluationDate) }}
            emptyState={<EmptyState title={t("accounting.settings.fxReval.noRuns")} />}
          />
        )}
      </div>
    </SectionCard>
  );
}
