import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@mms/ui";
import { cn } from "@mms/ui";
import { useTranslation } from "../i18n/index.js";
import { formatTrendDelta } from "./StatCardTrend.js";

export interface StatCardBodyProps {
  /** COLOR_MAP theme: { bg, text, ring, glow }. */
  colorTheme: { bg: string; text: string; ring: string; glow: string };
  icon: React.ReactNode;
  value: React.ReactNode;
  title: React.ReactNode;
  footer?: React.ReactNode;
  trend?: number;
  /** Trend unit: "percent" (default) or "points" (percentage-point delta). */
  trendKind?: "percent" | "points";
  /** Accessible label for the trend chip (overrides the default `ui.statCard.*` fallback). */
  trendAriaLabel?: string;
  /** Edit-mode action cluster rendered right of the trend chip. */
  actions?: React.ReactNode;
  className?: string;
  /**
   * Heading level for the card title. Platform dashboards keep the default `4`;
   * the tenant dashboard renders it under its own `h2` section heading, so it
   * passes `3` to keep the document outline sequential (2026-11-04 UI review).
   */
  titleHeadingLevel?: 3 | 4;
}

/** Vertical stat-card body — SSOT for icon tile + glow orb + trend chip + value/title/footer chrome. */
export function StatCardBody({
  colorTheme,
  icon,
  value,
  title,
  footer,
  trend,
  trendKind = "percent",
  trendAriaLabel,
  actions,
  className,
  titleHeadingLevel = 4,
}: StatCardBodyProps): React.JSX.Element {
  const { t } = useTranslation();
  const hasTrend = trend !== undefined && trend !== 0;
  const isPositive = (trend ?? 0) >= 0;
  const HeadingTag = titleHeadingLevel === 3 ? "h3" : "h4";

  return (
    <>
      <div
        className={`absolute -end-8 -top-8 w-24 h-24 rounded-full ${colorTheme.glow} transition-all duration-500`}
        aria-hidden="true"
      />
      <header
        // Content header: exempt from the global print rule that hides chrome headers.
        data-print-header
        className={cn("flex items-start justify-between mb-2 select-none", className)}
      >
        <div
          className={`w-8 h-8 rounded-lg ${colorTheme.bg} ring-4 ${colorTheme.ring} flex items-center justify-center aspect-square flex-shrink-0 transition-transform group-hover:scale-105 duration-300`}
          aria-hidden="true"
        >
          {icon}
        </div>
        {(hasTrend || actions) && (
          <div className="flex items-center gap-1">
            {hasTrend && (
              <Badge
                pill
                tone={isPositive ? "success" : "destructive"}
                className="gap-1 px-1.5 font-black"
                aria-label={
                  trendAriaLabel ??
                  (isPositive
                    ? `${t("ui.statCard.positiveTrend")} ${formatTrendDelta(trend as number, trendKind)}`
                    : `${t("ui.statCard.negativeTrend")} ${formatTrendDelta(trend as number, trendKind)}`)
                }
              >
                {isPositive ? (
                  <TrendingUp className="w-3 h-3 text-success shrink-0" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-destructive shrink-0" />
                )}
                <bdi dir="ltr" className="tabular-nums">
                  {isPositive ? "+" : "-"}
                  {/* Capped at 999 %+ and locale-formatted; a raw percent blew out
                      the card for near-new workspaces (2026-10-31 UX-18). */}
                  {formatTrendDelta(trend as number, trendKind)}
                </bdi>
              </Badge>
            )}
            {actions}
          </div>
        )}
      </header>
      <div className="flex items-end justify-between mt-0.5">
        <div className="space-y-1 flex-1 min-w-0">
          <HeadingTag className="text-xs font-bold text-muted-foreground m-0 break-words tracking-wide">
            {title}
          </HeadingTag>
          <p className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-tight m-0 break-words tabular-nums">
            <bdi dir="ltr">{value}</bdi>
          </p>
        </div>
      </div>
      {footer && (
        <footer className="text-xs font-medium text-muted-foreground mt-2 border-t border-border/30 pt-1.5 m-0 break-words">
          {footer}
        </footer>
      )}
    </>
  );
}
