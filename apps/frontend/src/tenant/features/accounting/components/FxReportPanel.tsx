import type React from "react";
import { formatDate, formatMoney, type FxExposureRow, type FxRealizedRow } from "@mms/shared";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";
import { useFxReport } from "@/tenant/features/accounting/hooks/useFxRevaluation";

type ExposureRow = FxExposureRow & { id: string };
type RealizedRow = FxRealizedRow & { id: string };
type RevaluationRow = { id: string; revaluationDate: string; totalUnrealized: string };

interface FxReportPanelProps {
  dateFrom: string;
  dateTo: string;
}

const signedClass = (value: string | null) =>
  `font-mono font-semibold ${value?.startsWith("-") ? "text-destructive" : "text-success"}`;

/** IAS 21 FX report: open exposure by currency, realized FX on payments, posted revaluations. */
export function FxReportPanel({ dateFrom, dateTo }: FxReportPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const report = useFxReport(dateFrom, dateTo);

  if (report.isError) {
    return (
      <ErrorState
        title={t("accounting.reports.fx.loadFailed")}
        description={t("accounting.loadFailedHint")}
        onRetry={() => void report.refetch()}
      />
    );
  }
  if (!report.data) return <Skeleton className="h-64 w-full rounded-2xl" />;

  const { functionalCurrency } = report.data;
  const money = (value: string | null, currency = functionalCurrency) =>
    value === null
      ? t("accounting.reports.fx.noRate")
      : formatMoney(Number(value), currency, { useSymbol: true });

  const exposureColumns: DataTableColumn<ExposureRow>[] = [
    {
      id: "currency",
      label: t("accounting.reports.fx.currency"),
      fixed: true,
      render: (row) => row.currency,
    },
    {
      id: "open",
      label: t("accounting.reports.fx.openBalance"),
      render: (row) => <span className="font-mono">{money(row.openTxn, row.currency)}</span>,
    },
    {
      id: "rate",
      label: t("accounting.reports.fx.closingRate"),
      render: (row) => row.closingRate ?? t("accounting.reports.fx.noRate"),
    },
    {
      id: "carrying",
      label: t("accounting.reports.fx.carrying"),
      hideInCard: true,
      render: (row) => <span className="font-mono">{money(row.carryingFunc)}</span>,
    },
    {
      id: "revalued",
      label: t("accounting.reports.fx.revalued"),
      hideInCard: true,
      render: (row) => <span className="font-mono">{money(row.revaluedFunc)}</span>,
    },
    {
      id: "unrealized",
      label: t("accounting.reports.fx.unrealized"),
      render: (row) => <span className={signedClass(row.unrealized)}>{money(row.unrealized)}</span>,
    },
  ];

  const realizedColumns: DataTableColumn<RealizedRow>[] = [
    {
      id: "currency",
      label: t("accounting.reports.fx.currency"),
      fixed: true,
      render: (row) => row.currency,
    },
    {
      id: "payments",
      label: t("accounting.reports.fx.payments"),
      render: (row) => String(row.payments),
    },
    {
      id: "realized",
      label: t("accounting.reports.fx.realized"),
      render: (row) => <span className={signedClass(row.realized)}>{money(row.realized)}</span>,
    },
  ];

  const revaluationColumns: DataTableColumn<RevaluationRow>[] = [
    {
      id: "date",
      label: t("accounting.reports.fx.revaluationDate"),
      fixed: true,
      render: (row) => formatDate(row.revaluationDate),
    },
    {
      id: "unrealized",
      label: t("accounting.reports.fx.unrealized"),
      render: (row) => (
        <span className={signedClass(row.totalUnrealized)}>{money(row.totalUnrealized)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="space-y-2" aria-labelledby="fx-report-exposure">
        <h3 id="fx-report-exposure" className="m-0 text-sm font-semibold text-balance">
          {t("accounting.reports.fx.exposureTitle", { date: formatDate(report.data.asOf) })}
        </h3>
        <DataTable
          tableId="accounting.fxReportExposure"
          label={t("accounting.reports.fx.exposureTitle", { date: formatDate(report.data.asOf) })}
          data={report.data.exposure.map((row) => ({ ...row, id: row.currency }))}
          columns={exposureColumns}
          card={{ title: (row) => row.currency }}
          emptyState={<EmptyState title={t("accounting.reports.fx.noExposure")} />}
        />
      </section>
      <section className="space-y-2" aria-labelledby="fx-report-realized">
        <h3 id="fx-report-realized" className="m-0 text-sm font-semibold text-balance">
          {t("accounting.reports.fx.realizedTitle", { amount: money(report.data.totalRealized) })}
        </h3>
        <DataTable
          tableId="accounting.fxReportRealized"
          label={t("accounting.reports.fx.realized")}
          data={report.data.realized.map((row) => ({ ...row, id: row.currency }))}
          columns={realizedColumns}
          card={{ title: (row) => row.currency }}
          emptyState={<EmptyState title={t("accounting.reports.fx.noRealized")} />}
        />
      </section>
      <section className="space-y-2" aria-labelledby="fx-report-revaluations">
        <h3 id="fx-report-revaluations" className="m-0 text-sm font-semibold text-balance">
          {t("accounting.reports.fx.revaluationsTitle")}
        </h3>
        <DataTable
          tableId="accounting.fxReportRevaluations"
          label={t("accounting.reports.fx.revaluationsTitle")}
          data={report.data.revaluations.map((row) => ({ ...row, id: row.revaluationDate }))}
          columns={revaluationColumns}
          card={{ title: (row) => formatDate(row.revaluationDate) }}
          emptyState={<EmptyState title={t("accounting.reports.fx.noRevaluations")} />}
        />
      </section>
    </div>
  );
}
