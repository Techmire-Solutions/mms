import React from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExportToolbar } from "@/components/ui/ExportToolbar";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useWorkDirectoryViewMode,
  type WorkDirectoryViewMode,
} from "@/hooks/useWorkDirectoryViewMode";
import { getInitials } from "@mms/shared";
import { Users } from "lucide-react";
import { useMemo } from "react";
import { WorkBatchTable } from "@/components/common/work/WorkBatchTable";
import type { WorkBatchTableFooterRow } from "@/components/common/work/workBatchTableTypes";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ObligationsRepDuesCardsView } from "./ObligationsRepDuesCardsView";

export interface RepSummaryEntry {
  key: string;
  repName: string;
  mujtahidName: string;
  count: number;
  total: number;
  due: number;
  byType: Record<string, number>;
}

interface ObligationsRepDuesSectionProps {
  repSummary: RepSummaryEntry[];
  totalAmount: number;
  activeCurrencyCode: string;
  formatCurrency: (amount: number | string | null | undefined) => string;
  formatValueOnly: (amount: number | string | null | undefined) => string;
  viewMode?: WorkDirectoryViewMode;
}

export function ObligationsRepDuesSection({
  repSummary,
  totalAmount,
  activeCurrencyCode,
  formatCurrency,
  formatValueOnly,
  viewMode: propViewMode,
}: ObligationsRepDuesSectionProps) {
  const { t } = useTranslation();
  const { viewMode: hookViewMode } = useWorkDirectoryViewMode();
  const viewMode = propViewMode ?? hookViewMode;
  const totalDue = repSummary.reduce(
    (sum, representativeSummary) => sum + representativeSummary.due,
    0,
  );

  const columns = useMemo(
    () => [
      {
        id: "representative",
        label: t("obligations.summary.rep.colRepresentative"),
        render: (row: RepSummaryEntry) => (
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"
              aria-hidden="true"
            >
              <span className="text-xs font-bold text-primary">{getInitials(row.repName)}</span>
            </div>
            <p className="font-semibold text-foreground text-sm m-0">{row.repName}</p>
          </div>
        ),
      },
      {
        id: "mujtahid",
        label: t("obligations.summary.rep.colMujtahid"),
        render: (row: RepSummaryEntry) => (
          <span className="text-xs text-muted-foreground">{row.mujtahidName}</span>
        ),
      },
      {
        id: "byType",
        label: t("obligations.summary.rep.colByType"),
        render: (row: RepSummaryEntry) => (
          <div className="flex flex-wrap gap-1">
            {Object.entries(row.byType).map(([name, amount]) => (
              <span
                key={name}
                className="text-xs font-medium px-1.5 py-0.5 rounded bg-muted border border-border text-foreground whitespace-nowrap"
              >
                {name}: {formatValueOnly(amount)}
              </span>
            ))}
          </div>
        ),
      },
      {
        id: "collections",
        label: t("obligations.summary.rep.colCollections"),
        align: "right" as const,
        render: (row: RepSummaryEntry) => (
          <span className="text-sm font-semibold text-foreground">{row.count}</span>
        ),
      },
      {
        id: "totalCollected",
        label: t("obligations.summary.rep.colTotalCollectedShort"),
        align: "right" as const,
        render: (row: RepSummaryEntry) => (
          <span className="text-sm font-semibold text-foreground whitespace-nowrap" dir="ltr">
            {formatCurrency(row.total)}
          </span>
        ),
      },
      {
        id: "dueToRep",
        label: t("obligations.summary.rep.colDueToRepShort"),
        headerClassName: "text-destructive",
        align: "right" as const,
        render: (row: RepSummaryEntry) => (
          <span className="text-sm font-bold text-destructive whitespace-nowrap" dir="ltr">
            {formatCurrency(row.due)}
          </span>
        ),
      },
    ],
    [t, formatValueOnly, formatCurrency],
  );

  const footerRows: WorkBatchTableFooterRow[] = useMemo(() => {
    if (repSummary.length === 0) return [];
    return [
      {
        cells: [
          {
            colSpan: 4,
            className: "table-footer-label",
            content: t("obligations.summary.rep.repCount", { count: repSummary.length }),
          },
          {
            align: "end",
            className: "font-bold text-foreground text-sm whitespace-nowrap",
            content: <span dir="ltr">{formatCurrency(totalAmount)}</span>,
          },
          {
            align: "end",
            className: "font-bold text-destructive text-sm whitespace-nowrap",
            content: <span dir="ltr">{formatCurrency(totalDue)}</span>,
          },
        ],
      },
    ];
  }, [repSummary.length, totalAmount, totalDue, formatCurrency, t]);

  return (
    <section aria-label={t("obligations.summary.rep.aria")}>
      <SectionHeader
        align="start"
        icon={<Users className="w-3.5 h-3.5 text-primary" aria-hidden="true" />}
        title={t("obligations.summary.rep.title")}
        subtitle={t("obligations.summary.rep.subtitle")}
        actions={
          <ExportToolbar
            title={t("obligations.summary.rep.title")}
            filename="rep_dues_summary"
            moduleId="obligations"
            exportLabel={t("obligations.summary.rep.exportLabel")}
            columns={[
              { header: t("obligations.summary.rep.colRepresentative"), key: "repName" },
              { header: t("obligations.summary.rep.colMujtahid"), key: "mujtahidName" },
              { header: t("obligations.summary.rep.colByType"), key: "byTypeFmt" },
              { header: t("obligations.summary.rep.colCollections"), key: "count" },
              {
                header: t("obligations.summary.rep.colTotalCollected", {
                  currency: activeCurrencyCode,
                }),
                key: "totalFmt",
              },
              {
                header: t("obligations.summary.rep.colDueToRep", { currency: activeCurrencyCode }),
                key: "dueFmt",
              },
            ]}
            rows={repSummary.map((representativeSummary) => ({
              ...representativeSummary,
              byTypeFmt: Object.entries(representativeSummary.byType)
                .map(([name, amount]) => `${name}: ${formatCurrency(amount)}`)
                .join("; "),
              totalFmt: formatCurrency(representativeSummary.total),
              dueFmt: formatCurrency(representativeSummary.due),
            }))}
          />
        }
      />
      {repSummary.length === 0 ? (
        <EmptyState
          variant="dashed"
          title={t("obligations.summary.emptyFiltered")}
          compact
          role="alert"
        />
      ) : viewMode === "cards" ? (
        <ObligationsRepDuesCardsView
          repSummary={repSummary}
          totalAmount={totalAmount}
          totalDue={totalDue}
          formatCurrency={formatCurrency}
          formatValueOnly={formatValueOnly}
        />
      ) : (
        <WorkBatchTable
          columns={columns}
          data={repSummary.map((r) => ({ ...r, id: r.key }))}
          footerRow={footerRows[0]}
          caption={t("obligations.summary.rep.title")}
        />
      )}
    </section>
  );
}
