import type React from "react";
import type { ReceivablesAging, ReceivablesAgingRow } from "@mms/shared";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccountingCurrency } from "@/hooks/useCurrency";
import { useTranslation } from "@/hooks/useTranslation";
import { runGridCsvExportJob } from "@/lib/backgroundJobs/runGridCsvExportJob";
import { useReceivablesAging } from "../hooks/useAccountingQueries";

interface ReceivablesAgingPanelProps {
  asOf: string;
}

type AgingRow = ReceivablesAgingRow & { id: string };

const BUCKETS = ["current", "d1_30", "d31_60", "d61_90", "d90_plus"] as const;

/**
 * Student receivables aging: open invoices bucketed by days past due as of the
 * selected report date. Computed server-side over the whole open AR ledger, so the
 * totals are not a page slice.
 */
export function ReceivablesAgingPanel({ asOf }: ReceivablesAgingPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const { formatCurrency } = useAccountingCurrency();
  const report = useReceivablesAging(asOf);
  const data: ReceivablesAging | undefined = report.data;

  if (report.isError) {
    return (
      <ErrorState
        title={t("accounting.reports.aging.loadFailed")}
        description={t("accounting.loadFailedHint")}
        onRetry={() => void report.refetch()}
      />
    );
  }
  if (!data) return <Skeleton className="h-64 w-full rounded-2xl" />;

  const rows: AgingRow[] = data.rows.map((row) => ({ ...row, id: row.studentId }));
  const bucketLabel: Record<(typeof BUCKETS)[number], string> = {
    current: t("accounting.reports.aging.current"),
    d1_30: t("accounting.reports.aging.d1_30"),
    d31_60: t("accounting.reports.aging.d31_60"),
    d61_90: t("accounting.reports.aging.d61_90"),
    d90_plus: t("accounting.reports.aging.d90_plus"),
  };

  const columns: DataTableColumn<AgingRow>[] = [
    {
      id: "student",
      kind: "shortText",
      label: t("accounting.reports.aging.student"),
      fixed: true,
      render: (row) => row.studentName || row.studentId,
    },
    {
      id: "class",
      kind: "shortText",
      label: t("accounting.reports.aging.class"),
      hideInCard: true,
      render: (row) => [row.className, row.sessionName].filter(Boolean).join(" · "),
    },
    ...BUCKETS.map((bucket) => ({
      id: bucket,
      kind: "money" as const,
      label: bucketLabel[bucket],
      render: (row: AgingRow) => <span className="font-mono">{formatCurrency(row[bucket])}</span>,
    })),
    {
      id: "total",
      kind: "money",
      label: t("accounting.reports.aging.total"),
      render: (row) => <span className="font-mono font-semibold">{formatCurrency(row.total)}</span>,
    },
  ];

  const exportCsv = () => {
    runGridCsvExportJob({
      moduleId: "accounting",
      label: t("accounting.reports.aging.exportLabel"),
      filename: `receivables-aging-${asOf}.csv`,
      columns: [
        { header: t("accounting.reports.aging.student"), key: "student" },
        { header: t("accounting.reports.aging.class"), key: "class" },
        ...BUCKETS.map((bucket) => ({ header: bucketLabel[bucket], key: bucket })),
        { header: t("accounting.reports.aging.items"), key: "invoiceCount" },
        { header: t("accounting.reports.aging.total"), key: "total" },
      ],
      rows: rows.map((row) => ({
        student: row.studentName || row.studentId,
        class: [row.className, row.sessionName].filter(Boolean).join(" · "),
        current: formatCurrency(row.current),
        d1_30: formatCurrency(row.d1_30),
        d31_60: formatCurrency(row.d31_60),
        d61_90: formatCurrency(row.d61_90),
        d90_plus: formatCurrency(row.d90_plus),
        invoiceCount: String(row.invoiceCount),
        total: formatCurrency(row.total),
      })),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {t("accounting.reports.aging.asOf", { date: asOf })}
          {data.hasMore ? ` — ${t("accounting.reports.aging.capped", { count: rows.length })}` : ""}
        </p>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
          {t("accounting.reports.aging.exportLabel")}
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState variant="dashed" title={t("accounting.reports.aging.empty")} compact />
      ) : (
        <DataTable
          tableId="accounting-receivables-aging"
          label={t("accounting.reports.aging.aria")}
          data={rows}
          columns={columns}
        />
      )}

      <dl className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/20 p-3 text-xs sm:grid-cols-4 lg:grid-cols-6">
        {BUCKETS.map((bucket) => (
          <div key={bucket}>
            <dt className="text-muted-foreground">{bucketLabel[bucket]}</dt>
            <dd className="font-mono font-semibold">{formatCurrency(data.totals[bucket])}</dd>
          </div>
        ))}
        <div>
          <dt className="text-muted-foreground">{t("accounting.reports.aging.total")}</dt>
          <dd className="font-mono font-semibold">{formatCurrency(data.totals.total)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("accounting.reports.aging.items")}</dt>
          <dd className="font-semibold">{data.totals.invoiceCount}</dd>
        </div>
      </dl>
    </div>
  );
}
