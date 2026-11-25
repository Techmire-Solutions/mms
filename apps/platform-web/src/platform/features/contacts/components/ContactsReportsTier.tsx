import React from "react";
import { BarChart3 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { StatCard } from "@mms/fe-core/components/StatCard";
import { SectionCard } from "@/components/app/SectionCard";
import { ReportChartCard } from "@/components/reports/ReportChartCard";
import { chartTooltipStyle } from "@mms/ui/app/ChartGrid";
import { useTranslation } from "@mms/fe-core/i18n";
import { usePlatformContactsMetrics } from "@/platform/features/contacts/hooks/usePlatformContacts";
import {
  PLATFORM_CONTACT_KINDS,
  PLATFORM_CONTACT_KIND_LABEL_KEYS,
} from "@/platform/features/contacts/lib/platformContactKinds";

const KIND_COLORS: Record<string, string> = {
  platform_operator: "hsl(var(--primary))",
  workspace_admin: "hsl(var(--info))",
  external: "hsl(var(--warning))",
};

/** Contacts → Reports: directory reachability + kind breakdown. */
export function ContactsReportsTier(): React.JSX.Element {
  const { t } = useTranslation();
  const { data } = usePlatformContactsMetrics();
  const metrics = (data ?? {}) as {
    total?: number;
    reachableEmail?: number;
    reachablePhone?: number;
    byKind?: Record<string, number>;
  };

  const kindData = PLATFORM_CONTACT_KINDS.map((kind) => ({
    name: t(PLATFORM_CONTACT_KIND_LABEL_KEYS[kind]),
    value: metrics.byKind?.[kind] ?? 0,
    color: KIND_COLORS[kind] ?? "hsl(var(--muted-foreground))",
  })).filter((entry) => entry.value > 0);

  return (
    <div className="space-y-4 text-start">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t("platform.contacts.total")} value={String(metrics.total ?? 0)} />
        <StatCard
          label={t("platform.contacts.reachableEmail")}
          value={String(metrics.reachableEmail ?? 0)}
        />
        <StatCard
          label={t("platform.contacts.reachablePhone")}
          value={String(metrics.reachablePhone ?? 0)}
        />
      </div>

      <SectionCard title={t("platform.contacts.reportsTitle")} icon={BarChart3}>
        <ReportChartCard
          title={t("platform.contacts.kind")}
          subtitle={t("platform.contacts.setupDesc")}
          heightClass="h-64"
          empty={kindData.length === 0}
          accessibleSummary={kindData.map((entry) => `${entry.name}: ${entry.value}`).join(", ")}
        >
          <PieChart>
            <Pie data={kindData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
              {kindData.map((entry) => (
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
