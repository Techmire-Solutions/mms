import React from "react";
import { CalendarCheck, CalendarClock, CalendarRange, Presentation, Users } from "lucide-react";
import { StatsSkeleton } from "@shared/ui";
import { ModuleCommandMetricsGrid } from "@/components/app/ModuleCommandMetricsGrid";
import { ErrorState } from "@/components/app/ErrorState";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkshopMetrics } from "../hooks/useWorkshopsApi";
import { WorkshopsReportTable } from "./WorkshopsReportTable";

/** Workshops Reports tier — headline counts plus a per-workshop attendance / completion table. */
export function WorkshopsReportsTab(): React.JSX.Element {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useWorkshopMetrics();

  if (isLoading) return <StatsSkeleton count={5} />;
  if (isError || !data) {
    return (
      <ErrorState
        title={t("workshops.loadFailed")}
        description={t("workshops.loadFailedHint")}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <ModuleCommandMetricsGrid
        items={[
          {
            key: "total",
            label: t("workshops.metrics.total"),
            value: data.total,
            icon: Presentation,
            accent: "primary",
          },
          {
            key: "upcoming",
            label: t("workshops.metrics.upcoming"),
            value: data.upcoming,
            icon: CalendarClock,
            accent: "warning",
          },
          {
            key: "ongoing",
            label: t("workshops.metrics.ongoing"),
            value: data.ongoing,
            icon: CalendarRange,
            accent: "success",
          },
          {
            key: "finished",
            label: t("workshops.metrics.finished"),
            value: data.finished,
            icon: CalendarCheck,
          },
          {
            key: "participants",
            label: t("workshops.metrics.participants"),
            value: data.participants,
            icon: Users,
          },
        ]}
      />
      <WorkshopsReportTable />
    </div>
  );
}
