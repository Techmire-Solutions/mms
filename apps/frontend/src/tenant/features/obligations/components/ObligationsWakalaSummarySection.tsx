import { EmptyState } from "@/components/app/EmptyState";
import { ExportToolbar } from "@/components/app/ExportToolbar";
import { Badge } from "@/components/ui/badge";
import { WorkBatchTable } from "@/components/common/work/WorkBatchTable";
import type { WorkBatchTableFooterRow } from "@/components/common/work/workBatchTableTypes";
import { useTranslation } from "@/hooks/useTranslation";
import { useMemo } from "react";
import {
  useWorkDirectoryViewMode,
  type WorkDirectoryViewMode,
} from "@/hooks/useWorkDirectoryViewMode";
import type { ObligationDistribution } from "@/lib/data/obligationsData";
import { AlertCircle, Layers } from "lucide-react";
import { SectionHeader } from "@shared/ui";
import { ObligationsWakalaSummaryCardsView } from "./ObligationsWakalaSummaryCardsView";

/** ReportMoneyCard tile (report) — not DirectoryCard. */
export interface WakalaSummaryEntry {
  key: string;
  label: string;
  repName: string;
  mujtahidName: string;
  obligationType: string;
  count: number;
  total: number;
  hasWakala: boolean;
  distributions: ObligationDistribution[];
}

interface ObligationsWakalaSummarySectionProps {
  wakalaSummary: WakalaSummaryEntry[];
  totalAmount: number;
  activeCurrencyCode: string;
  formatCurrency: (amount: number | string | null | undefined) => string;
  viewMode?: WorkDirectoryViewMode;
}

export function ObligationsWakalaSummarySection({
  wakalaSummary,
  totalAmount,
  activeCurrencyCode,
  formatCurrency,
  viewMode: propViewMode,
}: ObligationsWakalaSummarySectionProps) {
  const { t } = useTranslation();
  const { viewMode: hookViewMode } = useWorkDirectoryViewMode();
  const viewMode = propViewMode ?? hookViewMode;

  const columns = useMemo(
    () => [
      {
        id: "repWakala",
        label: t("obligations.summary.wakala.colRepWakala"),
        render: (row: WakalaSummaryEntry) => (
          <div className="flex flex-col gap-0.5">
            <p className="font-semibold text-foreground text-sm m-0">{row.repName}</p>
            {!row.hasWakala && (
              <span
                className="inline-flex items-center gap-1 text-xs text-warning font-bold"
                aria-label={t("obligations.summary.wakala.noConfigAria")}
              >
                <AlertCircle className="w-3 h-3" aria-hidden="true" />{" "}
                {t("obligations.summary.wakala.noConfig")}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "mujtahid",
        label: t("obligations.summary.wakala.colMujtahid"),
        render: (row: WakalaSummaryEntry) => (
          <span className="text-xs text-muted-foreground">{row.mujtahidName}</span>
        ),
      },
      {
        id: "obligation",
        label: t("obligations.summary.wakala.colObligation"),
        render: (row: WakalaSummaryEntry) => (
          <Badge as="span" pill tone="primary" className="px-2 font-bold">
            {row.obligationType}
          </Badge>
        ),
      },
      {
        id: "collections",
        label: t("obligations.summary.wakala.colCollections"),
        align: "right" as const,
        render: (row: WakalaSummaryEntry) => (
          <span className="text-sm font-semibold text-foreground">{row.count}</span>
        ),
      },
      {
        id: "totalAmount",
        label: t("obligations.summary.wakala.colTotalAmountShort"),
        align: "right" as const,
        render: (row: WakalaSummaryEntry) => (
          <span className="text-sm font-bold text-success whitespace-nowrap" dir="ltr">
            {formatCurrency(row.total)}
          </span>
        ),
      },
      {
        id: "distributions",
        label: t("obligations.summary.wakala.colDistributions"),
        render: (row: WakalaSummaryEntry) =>
          row.distributions.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {row.distributions.map((distribution) => (
                <span
                  key={distribution.id}
                  className={`text-xs font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${distribution.type === "Liability" ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-success/10 border-success/30 text-success"}`}
                >
                  {distribution.name} {distribution.percentage}%
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
    ],
    [t, formatCurrency],
  );

  const footerRows: WorkBatchTableFooterRow[] = useMemo(() => {
    if (wakalaSummary.length === 0) return [];
    return [
      {
        cells: [
          {
            colSpan: 4,
            className: "table-footer-label",
            content: t("obligations.summary.wakala.configCount", { count: wakalaSummary.length }),
          },
          {
            align: "end",
            className: "font-bold text-success text-sm whitespace-nowrap",
            content: <span dir="ltr">{formatCurrency(totalAmount)}</span>,
          },
          { content: "" },
        ],
      },
    ];
  }, [wakalaSummary.length, totalAmount, formatCurrency, t]);

  return (
    <section aria-label={t("obligations.summary.wakala.aria")}>
      <SectionHeader
        align="start"
        icon={<Layers className="w-3.5 h-3.5 text-primary" aria-hidden="true" />}
        title={t("obligations.summary.wakala.title")}
        subtitle={t("obligations.summary.wakala.subtitle")}
        actions={
          <ExportToolbar
            title={t("obligations.summary.wakala.title")}
            filename="wakala_summary"
            moduleId="obligations"
            exportLabel={t("obligations.summary.wakala.exportLabel")}
            columns={[
              { header: t("obligations.summary.wakala.colRepWakala"), key: "repName" },
              { header: t("obligations.summary.wakala.colMujtahid"), key: "mujtahidName" },
              { header: t("obligations.summary.wakala.colObligationType"), key: "obligationType" },
              { header: t("obligations.summary.wakala.colCollections"), key: "count" },
              {
                header: t("obligations.summary.wakala.colTotalAmount", {
                  currency: activeCurrencyCode,
                }),
                key: "totalFmt",
              },
              { header: t("obligations.summary.wakala.colDistributions"), key: "distFmt" },
            ]}
            rows={wakalaSummary.map((wakalaSummaryItem) => ({
              ...wakalaSummaryItem,
              totalFmt: formatCurrency(wakalaSummaryItem.total),
              distFmt:
                wakalaSummaryItem.distributions
                  .map((distribution) => `${distribution.name} ${distribution.percentage}%`)
                  .join("; ") || "—",
            }))}
          />
        }
      />
      {wakalaSummary.length === 0 ? (
        <EmptyState
          variant="dashed"
          title={t("obligations.summary.emptyFiltered")}
          compact
          role="alert"
        />
      ) : viewMode === "cards" ? (
        <ObligationsWakalaSummaryCardsView
          wakalaSummary={wakalaSummary}
          totalAmount={totalAmount}
          formatCurrency={formatCurrency}
        />
      ) : (
        <WorkBatchTable
          columns={columns}
          data={wakalaSummary.map((r) => ({ ...r, id: r.key }))}
          footerRow={footerRows[0]}
          caption={t("obligations.summary.wakala.title")}
        />
      )}
    </section>
  );
}
