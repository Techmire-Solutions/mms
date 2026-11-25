import React from "react";
import { BarChart3 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { StatCard } from "@mms/fe-core/components/StatCard";
import { SectionCard } from "@/components/app/SectionCard";
import { ReportChartCard } from "@/components/reports/ReportChartCard";
import { chartTooltipStyle } from "@mms/ui/app/ChartGrid";
import { useTranslation } from "@mms/fe-core/i18n";
import { usePlatformMessagingMetrics } from "@/platform/features/messaging/hooks/usePlatformMessaging";

import {
  PLATFORM_MESSAGING_CHANNELS,
  PLATFORM_MESSAGING_CHANNEL_LABEL_KEYS,
} from "@/platform/features/messaging/lib/platformMessagingChannels";
const CHANNEL_COLORS: Record<string, string> = {
  sms: "hsl(var(--primary))",
  whatsapp: "hsl(var(--success))",
  email: "hsl(var(--info))",
};

/** Messaging → Reports: send volume by channel. */
export function MessagingReportsTier(): React.JSX.Element {
  const { t } = useTranslation();
  const { data } = usePlatformMessagingMetrics();
  const metrics = (data ?? {}) as {
    total?: number;
    byStatus?: Record<string, number>;
    byChannel?: Record<string, number>;
  };

  const channelData = PLATFORM_MESSAGING_CHANNELS.map((channel) => ({
    name: t(PLATFORM_MESSAGING_CHANNEL_LABEL_KEYS[channel]),
    value: metrics.byChannel?.[channel] ?? 0,
    color: CHANNEL_COLORS[channel] ?? "hsl(var(--muted-foreground))",
  })).filter((entry) => entry.value > 0);

  return (
    <div className="space-y-4 text-start">
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

      <SectionCard title={t("platform.messaging.reportsTitle")} icon={BarChart3}>
        <ReportChartCard
          title={t("platform.messaging.channel")}
          subtitle={t("platform.messaging.subtitle")}
          heightClass="h-64"
          empty={channelData.length === 0}
          accessibleSummary={channelData.map((entry) => `${entry.name}: ${entry.value}`).join(", ")}
        >
          <PieChart>
            <Pie
              data={channelData}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={80}
            >
              {channelData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={chartTooltipStyle()} />
          </PieChart>
        </ReportChartCard>
      </SectionCard>
    </div>
  );
}
