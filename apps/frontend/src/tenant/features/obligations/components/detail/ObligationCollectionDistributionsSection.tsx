import React from "react";
import { formatMoney } from "@mms/shared";
import { WORK_SURFACE, WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { useMemo } from "react";
import { WorkBatchTable } from "@/components/common/work/WorkBatchTable";
import type { WorkBatchTableFooterRow } from "@/components/common/work/workBatchTableTypes";
import { Alert } from "@/components/app/Alert";
import { StatGrid, StatRow } from "@/components/app/StatGrid";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import type {
  ObligationCollection,
  WakalaType,
  ObligationDistribution,
} from "@/lib/data/obligationsData";

interface ObligationCollectionDistributionsSectionProps {
  collection: ObligationCollection;
  dists: ObligationDistribution[];
  wakalaType: WakalaType | undefined;
  totalPct: number;
  totalAmount: number;
  currency: { code?: string } | null | undefined;
  distributionTypeConfig: Record<string, StatusBadgeConfigItem>;
}

export function ObligationCollectionDistributionsSection({
  collection,
  dists,
  wakalaType,
  totalPct,
  totalAmount,
  currency,
  distributionTypeConfig,
}: ObligationCollectionDistributionsSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const { viewMode } = useWorkDirectoryViewMode();

  const columns = useMemo(
    () => [
      {
        id: "name",
        label: t("obligations.detail.colName"),
        render: (row: ObligationDistribution) => (
          <span className="font-medium text-foreground">{row.name}</span>
        ),
      },
      {
        id: "type",
        label: t("obligations.detail.colType"),
        render: (row: ObligationDistribution) => (
          <StatusBadge status={row.type} config={distributionTypeConfig} size="sm" />
        ),
      },
      {
        id: "pct",
        label: t("obligations.detail.colPct"),
        align: "right" as const,
        render: (row: ObligationDistribution) => (
          <span className="text-xs font-semibold whitespace-nowrap" dir="ltr">
            {row.percentage}%
          </span>
        ),
      },
      {
        id: "amount",
        label: t("obligations.columns.amount"),
        align: "right" as const,
        render: (row: ObligationDistribution) => (
          <span className="text-xs font-semibold text-foreground whitespace-nowrap" dir="ltr">
            {formatMoney((collection.amount * row.percentage) / 100, currency?.code)}
          </span>
        ),
      },
    ],
    [t, distributionTypeConfig, collection.amount, currency?.code],
  );

  const footerRows: WorkBatchTableFooterRow[] = useMemo(() => {
    if (dists.length === 0) return [];
    return [
      {
        cells: [
          {
            colSpan: 2,
            className: "table-footer-label text-foreground",
            content: t("reports.fields.total"),
          },
          {
            align: "end",
            className: "font-bold text-xs whitespace-nowrap",
            content: <span dir="ltr">{totalPct}%</span>,
          },
          {
            align: "end",
            className: "font-bold text-foreground text-xs whitespace-nowrap",
            content: <span dir="ltr">{formatMoney(totalAmount, currency?.code)}</span>,
          },
        ],
      },
    ];
  }, [dists.length, totalPct, totalAmount, currency?.code, t]);

  return (
    <>
      {dists.length > 0 && (
        <section aria-label={t("obligations.detail.distribution")}>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 m-0">
            {t("obligations.detail.distribution")}
          </h4>
          {viewMode === "cards" ? (
            <div className={`${WORK_SURFACE} space-y-3 p-3`}>
              {dists.map((distribution) => (
                <article key={distribution.id} className={`${WORK_SURFACE_INNER} space-y-2 p-3`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-foreground m-0">{distribution.name}</p>
                    <StatusBadge
                      status={distribution.type}
                      config={distributionTypeConfig}
                      size="sm"
                    />
                  </div>
                  <StatGrid>
                    <StatRow
                      label={t("obligations.detail.colPct")}
                      value={`${distribution.percentage}%`}
                      ddClassName="font-mono text-xs font-semibold"
                    />
                    <StatRow
                      label={t("obligations.columns.amount")}
                      value={formatMoney(
                        (collection.amount * distribution.percentage) / 100,
                        currency?.code,
                      )}
                      ddClassName="font-mono text-xs font-semibold"
                    />
                  </StatGrid>
                </article>
              ))}
              <div className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-lg border border-border/50 text-xs font-semibold">
                <span>{t("reports.fields.total")}</span>
                <span className="font-mono">
                  {totalPct}% • {formatMoney(totalAmount, currency?.code)}
                </span>
              </div>
            </div>
          ) : (
            <WorkBatchTable
              columns={columns}
              data={dists.map((d) => ({ ...d, id: d.id.toString() }))}
              footerRow={footerRows[0]}
              caption={t("obligations.detail.distributionCaption", {
                receipt: collection.receipt_no,
              })}
            />
          )}
        </section>
      )}

      {dists.length === 0 && wakalaType && (
        <Alert
          density="compact"
          role="alert"
          className="text-warning"
          description={t("obligations.detail.noDistribution")}
        />
      )}
    </>
  );
}
