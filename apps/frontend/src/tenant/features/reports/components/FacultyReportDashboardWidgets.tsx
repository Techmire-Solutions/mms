import React, { useMemo } from "react";
import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";
import { SafeResponsiveContainer } from "@/components/ui/SafeResponsiveContainer";
import { ChartGrid, chartAxisTick } from "@/components/ui/ChartGrid";
import { SectionCard } from "@/components/ui/SectionCard";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useTranslation } from "@/hooks/useTranslation";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";

export const FacultyReportDashboardWidgets = React.memo(
  function FacultyReportDashboardWidgets(): React.JSX.Element {
    const { t } = useTranslation();
    const sessions = useSessionsCollection();

    const classesPerSession = useMemo(
      () =>
        sessions
          .map((session) => ({
            name: session.name || "—",
            value: session.classes?.length ?? 0,
          }))
          .sort((leftPoint, rightPoint) => rightPoint.value - leftPoint.value),
      [sessions],
    );

    return (
      <div className="border-t border-border/50 pt-6 mt-6 space-y-4">
        <div>
          <h3 className="text-sm font-black text-foreground uppercase tracking-widest">
            {t("faculty.report.dashboardWidgetsTitle")}
          </h3>
          <SectionLabel as="p" weight="bold" tracking="wider" className="mt-0.5">
            {t("faculty.report.dashboardWidgetsSubtitle")}
          </SectionLabel>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title={t("faculty.report.classesPerSession")}>
            <SafeResponsiveContainer width="100%" height={200}>
              <BarChart data={classesPerSession} barSize={24}>
                <ChartGrid />
                <XAxis
                  dataKey="name"
                  tick={chartAxisTick(11)}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={50}
                />
                <YAxis allowDecimals={false} tick={chartAxisTick(11)} />
                <Tooltip />
                <Bar
                  dataKey="value"
                  fill="hsl(var(--primary))"
                  name={t("faculty.report.colClasses")}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </SafeResponsiveContainer>
          </SectionCard>
        </div>
      </div>
    );
  },
);
