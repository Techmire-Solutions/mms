import React from "react";
import { BarChart3 } from "lucide-react";
import { StatCard } from "@/components/app/StatCard";
import { SectionCard } from "@/components/app/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlatformMessagingMetrics } from "@/platform/features/messaging/hooks/usePlatformMessaging";

/** Messaging → Reports: send volume by status/channel. */
export function MessagingReportsTier(): React.JSX.Element {
  const { t } = useTranslation();
  const { data } = usePlatformMessagingMetrics();
  const metrics = (data ?? {}) as { total?: number; byStatus?: Record<string, number> };

  return (
    <SectionCard title={t("platform.messaging.reportsTitle")} icon={BarChart3}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t("platform.messaging.total")} value={String(metrics.total ?? 0)} />
        <StatCard
          label={t("platform.messaging.sentCount")}
          value={String(metrics.byStatus?.sent ?? 0)}
        />
        <StatCard
          label={t("platform.messaging.failedCount")}
          value={String(metrics.byStatus?.failed ?? 0)}
        />
      </div>
    </SectionCard>
  );
}
