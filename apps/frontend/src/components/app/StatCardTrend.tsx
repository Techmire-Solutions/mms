import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatPercent } from "@mms/shared";
import { cn } from "@/lib/utils";
import { trendTextClass } from "@/lib/ui/semanticTone";
import { useTranslation } from "@/hooks/useTranslation";

/** Above this the raw delta stops being meaningful (and overflows the card). */
export const TREND_DISPLAY_CAP = 999;

export interface StatCardTrendProps {
  trend: number;
  trendLabel?: string;
}

/**
 * Formats a trend delta for display: locale numerals, a 999%+ cap, and a
 * finite-number guard. A prior-period jump from 1 to 382 workspaces rendered as
 * `↗ 42467%` and blew out the card (2026-10-31 review, UX-18).
 */
export function formatTrendDelta(trend: number): string {
  if (!Number.isFinite(trend)) return formatPercent(0);
  const magnitude = Math.abs(trend);
  const capped = Math.min(magnitude, TREND_DISPLAY_CAP);
  return `${formatPercent(capped)}${magnitude > TREND_DISPLAY_CAP ? "+" : ""}`;
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
        {formatTrendDelta(trend)}
      </span>
      {trendLabel && (
        <span className="text-2xs text-muted-foreground font-normal leading-tight">
          {trendLabel}
        </span>
      )}
    </span>
  );
});
