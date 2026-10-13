import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

export interface StatCardBodyProps {
  /** COLOR_MAP theme: { bg, text, ring, glow }. */
  colorTheme: { bg: string; text: string; ring: string; glow: string };
  icon: React.ReactNode;
  value: React.ReactNode;
  title: React.ReactNode;
  footer?: React.ReactNode;
  trend?: number;
  /** Accessible label for the trend chip (overrides the default `ui.statCard.*` fallback). */
  trendAriaLabel?: string;
  /** Edit-mode action cluster rendered right of the trend chip. */
  actions?: React.ReactNode;
  className?: string;
}

/** Vertical stat-card body — SSOT for icon tile + glow orb + trend chip + value/title/footer chrome. */
export function StatCardBody({
  colorTheme,
  icon,
  value,
  title,
  footer,
  trend,
  trendAriaLabel,
  actions,
  className,
}: StatCardBodyProps): React.JSX.Element {
  const { t } = useTranslation();
  const hasTrend = trend !== undefined && trend !== 0;
  const isPositive = (trend ?? 0) >= 0;

  return (
    <>
      <div
        className={`absolute -end-8 -top-8 w-24 h-24 rounded-full ${colorTheme.glow} transition-all duration-500`}
        aria-hidden="true"
      />
      <header className={cn("flex items-start justify-between mb-3 select-none", className)}>
        <div
          className={`w-9 h-9 rounded-lg ${colorTheme.bg} ring-4 ${colorTheme.ring} flex items-center justify-center aspect-square flex-shrink-0 transition-transform group-hover:scale-105 duration-300`}
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
                    ? `${t("ui.statCard.positiveTrend")} ${Math.abs(trend as number)}%`
                    : `${t("ui.statCard.negativeTrend")} ${Math.abs(trend as number)}%`)
                }
              >
                {isPositive ? (
                  <TrendingUp className="w-3 h-3 text-success shrink-0" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-destructive shrink-0" />
                )}
                <span>
                  {isPositive ? "+" : ""}
                  {trend}%
                </span>
              </Badge>
            )}
            {actions}
          </div>
        )}
      </header>
      <div className="flex items-end justify-between mt-1">
        <div className="space-y-0.5 flex-1 min-w-0">
          <p className="text-2xl font-black text-foreground tracking-tight leading-none m-0 truncate tabular-nums">
            {value}
          </p>
          <h4 className="text-sm font-bold text-foreground mt-1.5 m-0 truncate tracking-wide">
            {title}
          </h4>
        </div>
      </div>
      {footer && (
        <footer className="text-xs font-medium text-foreground mt-3 border-t border-border/30 pt-2 m-0 truncate">
          {footer}
        </footer>
      )}
    </>
  );
}
