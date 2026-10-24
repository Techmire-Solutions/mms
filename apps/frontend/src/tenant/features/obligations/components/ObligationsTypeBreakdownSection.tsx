import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CARD_STRIPE_INSET } from "@/lib/ui/semanticTone";
import { ExportToolbar } from "@/components/app/ExportToolbar";
import { useTranslation } from "@/hooks/useTranslation";
import { BarChart2 } from "lucide-react";

import { SectionHeader } from "@shared/ui";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/app/ProgressBar";
import type { TypeBreakdownEntry } from "./ObligationsSummaryChartsSection";

interface ObligationsTypeBreakdownSectionProps {
  typeBreakdown: TypeBreakdownEntry[];
  colors: string[];
  totalAmount: number;
  activeCurrencyCode: string;
  formatCurrency: (amount: number | string | null | undefined) => string;
  formatValueOnly: (amount: number | string | null | undefined) => string;
}

export function ObligationsTypeBreakdownSection({
  typeBreakdown,
  colors,
  totalAmount,
  activeCurrencyCode,
  formatCurrency,
  formatValueOnly,
}: ObligationsTypeBreakdownSectionProps) {
  const { t } = useTranslation();

  return (
    <section aria-label={t("obligations.summary.types.aria")}>
      <SectionHeader
        align="start"
        icon={<BarChart2 className="w-3.5 h-3.5 text-primary" aria-hidden="true" />}
        title={t("obligations.summary.types.title")}
        subtitle={t("obligations.summary.types.subtitle")}
        actions={
          <ExportToolbar
            title={t("obligations.summary.types.title")}
            filename="obligation_type_breakdown"
            moduleId="obligations"
            exportLabel={t("obligations.summary.types.exportLabel")}
            columns={[
              { header: t("obligations.summary.types.colType"), key: "name" },
              { header: t("obligations.summary.types.colCollections"), key: "count" },
              {
                header: t("obligations.summary.types.colTotalAmount", {
                  currency: activeCurrencyCode,
                }),
                key: "totalFmt",
              },
              { header: t("obligations.summary.types.colShare"), key: "shareFmt" },
            ]}
            rows={typeBreakdown.map((typeBreakdownItem) => ({
              ...typeBreakdownItem,
              totalFmt: formatCurrency(typeBreakdownItem.total),
              shareFmt: totalAmount
                ? ((typeBreakdownItem.total / totalAmount) * 100).toFixed(1) + "%"
                : "0%",
            }))}
          />
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {typeBreakdown.map((typeBreakdownItem, index) => {
          const sharePercent = totalAmount ? (typeBreakdownItem.total / totalAmount) * 100 : 0;

          return (
            <Card
              key={typeBreakdownItem.name}
              accentColor="primary"
              className={cn("p-4 space-y-1.5 transition-all", CARD_STRIPE_INSET)}
            >
              <header className="flex min-w-0 items-center justify-between gap-2">
                <h3 className="min-w-0 truncate text-xs font-bold text-foreground m-0">
                  {typeBreakdownItem.name}
                </h3>
                <Badge
                  pill
                  variant="outline"
                  className="shrink-0 px-1.5 font-bold text-white border-transparent"
                  style={{ background: colors[index % colors.length] }}
                >
                  {typeBreakdownItem.count}
                </Badge>
              </header>
              <p className="text-lg font-bold text-foreground font-mono m-0">
                {formatValueOnly(typeBreakdownItem.total)}
              </p>
              <p className="text-xs text-muted-foreground m-0">
                {t("obligations.summary.types.countWithCurrency", {
                  currency: activeCurrencyCode,
                  count: typeBreakdownItem.count,
                })}
              </p>
              <ProgressBar
                className="mt-1"
                value={sharePercent}
                fillStyle={{ background: colors[index % colors.length] }}
              />
              <p className="text-xs text-muted-foreground text-end m-0">
                {totalAmount ? sharePercent.toFixed(1) : 0}%
              </p>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
