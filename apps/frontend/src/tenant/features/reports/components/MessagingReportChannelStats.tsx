import React from "react";
import {
  MESSAGING_CHANNEL_CONFIG,
  type MessagingChannelConfig,
} from "@/tenant/hooks/collections/messaging";
import { getChannelLabelKey } from "@mms/shared";
import { WORK_SURFACE, WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { SEMANTIC_TEXT, getSolidBgClass } from "@/lib/ui/semanticTone";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface MessagingReportChannelStatsProps {
  stats?: Record<string, unknown> | null;
  total: number;
  calcPercentage: (count: number) => string;
  t: TranslationFunction;
}

export function MessagingReportChannelStats({
  stats,
  total,
  calcPercentage,
  t,
}: MessagingReportChannelStatsProps): React.JSX.Element {
  return (
    <div className={`${WORK_SURFACE} p-4 space-y-3 flex flex-col justify-between`}>
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          {t("messaging.channel")}
        </h4>

        {total > 0 && (
          <div className="mb-4 space-y-1.5">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted/60">
              {(Object.values(MESSAGING_CHANNEL_CONFIG) as MessagingChannelConfig[]).map(
                (config) => {
                  const count = (stats?.[`${config.id}Count` as keyof typeof stats] as number) ?? 0;
                  if (count === 0) return null;
                  return (
                    <div
                      key={config.id}
                      style={{ width: `${(count / total) * 100}%` }}
                      className={`${getSolidBgClass(config.themeAccent)} transition-all duration-300`}
                      title={`${t(getChannelLabelKey(config.id))}: ${calcPercentage(count)}`}
                    />
                  );
                },
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className={`${WORK_SURFACE_INNER} p-3 flex items-center justify-between`}>
            <span className="text-xs font-medium text-foreground">
              {t("messaging.stats.total")}
            </span>
            <span className={`font-bold text-sm ${SEMANTIC_TEXT.primary}`}>{total}</span>
          </div>
          {(Object.values(MESSAGING_CHANNEL_CONFIG) as MessagingChannelConfig[]).map((config) => {
            const count = (stats?.[`${config.id}Count` as keyof typeof stats] as number) ?? 0;
            return (
              <div
                key={config.id}
                className={`${WORK_SURFACE_INNER} p-3 flex items-center justify-between`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${getSolidBgClass(config.themeAccent)}`} />
                  <span className="text-xs font-medium text-foreground">
                    {t(getChannelLabelKey(config.id))}
                  </span>
                </div>
                <div className="text-end">
                  <span
                    className={`font-bold text-sm ${SEMANTIC_TEXT[config.themeAccent as keyof typeof SEMANTIC_TEXT]}`}
                  >
                    {count}
                  </span>
                  <span className="text-3xs font-mono text-muted-foreground ms-1.5">
                    ({calcPercentage(count)})
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
