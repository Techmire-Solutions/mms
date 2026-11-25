import React from "react";
import { MessageSquare, CheckCircle2, XCircle } from "lucide-react";
import { useTranslation } from "@mms/fe-core/i18n";
import { ModuleCommandMetricsGrid } from "@mms/fe-core/components/ModuleCommandMetricsGrid";
import { StatsSkeleton } from "@mms/ui";
import { usePlatformMessagingMetrics } from "@/platform/features/messaging/hooks/usePlatformMessaging";

interface MessagingMetrics {
  total?: number;
  byStatus?: Record<string, number>;
}

/** Messaging command metrics strip (send KPIs, visible across all tiers). */
export function PlatformMessagingCommandMetrics(): React.JSX.Element | null {
  const { t } = useTranslation();
  const { data, isLoading, isError } = usePlatformMessagingMetrics();
  const metrics = (data ?? {}) as MessagingMetrics;

  if (isError) return null;
  if (isLoading) return <StatsSkeleton count={3} />;

  return (
    <ModuleCommandMetricsGrid
      items={[
        {
          icon: MessageSquare,
          label: t("platform.messaging.total"),
          value: metrics.total ?? 0,
          accent: "primary",
        },
        {
          icon: CheckCircle2,
          label: t("platform.messaging.sentCount"),
          value: metrics.byStatus?.sent ?? 0,
          accent: "success",
        },
        {
          icon: XCircle,
          label: t("platform.messaging.failedCount"),
          value: metrics.byStatus?.failed ?? 0,
          accent: "destructive",
        },
      ]}
    />
  );
}
