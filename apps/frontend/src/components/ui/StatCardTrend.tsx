import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { trendTextClass } from "@/lib/semanticTone";
import { useTranslation } from "@/hooks/useTranslation";

export interface StatCardTrendProps {
  trend: number;
  trendLabel?: string;
}

export const StatCardTrend = React.memo(function StatCardTrend({
  trend,
  trendLabel,
}: StatCardTrendProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <span className="flex flex-col items-end gap-0 shrink-0 select-none">
      <span
        className={cn("flex items-center gap-0.5 text-xs font-bold", trendTextClass(trend))}
        aria-label={trend >= 0 ? t("ui.statCard.positiveTrend") : t("ui.statCard.negativeTrend")}
      >
        {trend >= 0 ? (
          <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
        ) : (
          <ArrowDownRight className="w-3 h-3" aria-hidden="true" />
        )}
        {Math.abs(trend)}%
      </span>
      {trendLabel && (
        <span className="text-2xs text-muted-foreground font-normal leading-tight">
          {trendLabel}
        </span>
      )}
    </span>
  );
});
