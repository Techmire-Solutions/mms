import SessionsTable from "@/components/dashboard-widgets/SessionsTable";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useTranslation } from "@/hooks/useTranslation";
import type { SessionsReportTodaySession } from "@mms/shared";

interface SessionReportDashboardWidgetsProps {
  todaysSessions: SessionsReportTodaySession[];
}

export function SessionReportDashboardWidgets({
  todaysSessions,
}: SessionReportDashboardWidgetsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="border-t border-border/50 pt-6 mt-6 space-y-4 text-start">
      <div>
        <h3 className="text-sm font-black text-foreground uppercase tracking-widest">
          {t("sessions.report.dashboardWidgetTitle")}
        </h3>
        <SectionLabel as="p" weight="bold" tracking="wider" className="mt-0.5">
          {t("sessions.report.dashboardWidgetSubtitle")}
        </SectionLabel>
      </div>
      <SessionsTable items={todaysSessions} />
    </div>
  );
}
