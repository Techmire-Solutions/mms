import React from "react";
import { useTranslation } from "@/hooks/useTranslation";

export interface PlatformLatencySparklineProps {
  history: number[];
  currentLatency: number | null;
  avgLatency: number | null;
}

export function PlatformLatencySparkline({
  history,
  avgLatency,
}: PlatformLatencySparklineProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (history.length === 0) return null;

  const maxVal = Math.max(...history, 150);

  return (
    <div
      role="region"
      aria-label={t("platform.maintenance.recentPings")}
      className="flex items-center gap-2 bg-card px-2.5 py-1 rounded-lg border border-border/50 text-xs"
    >
      <span className="text-3xs font-semibold text-muted-foreground uppercase tracking-wider">
        {t("platform.maintenance.recentPings")}:
      </span>

      {/* Mini-sparkline bars */}
      <div className="flex items-end gap-1 h-5 px-0.5" aria-hidden="true">
        {history.map((latency, idx) => {
          const heightPercent = Math.max(15, Math.min(100, Math.round((latency / maxVal) * 100)));
          const colorClass =
            latency < 100 ? "bg-success" : latency < 250 ? "bg-primary" : "bg-warning";

          return (
            <div
              key={`ping-${idx}-${latency}`}
              style={{ height: `${heightPercent}%` }}
              className={`w-1.5 rounded-xs ${colorClass} transition-all duration-300`}
              title={`${latency} ms`}
            />
          );
        })}
      </div>

      {avgLatency !== null ? (
        <span className="text-3xs font-mono font-bold text-foreground ps-1 border-s border-border/50">
          {t("platform.maintenance.avgLatency")}: {avgLatency} ms
        </span>
      ) : null}
    </div>
  );
}
