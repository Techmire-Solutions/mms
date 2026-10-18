import React from "react";
import { School, Filter, UserCheck, UserX } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useFacultyMetrics } from "@/tenant/features/faculty/hooks/useFaculty";
import { ModuleCommandMetricsGrid } from "@/components/app/ModuleCommandMetricsGrid";
import { resolveFacultyStatusRoles } from "@mms/shared";
import { facultyStatusMetricAccent } from "@/lib/faculty/facultyStatusUi";

export interface FacultyCommandMetricsProps {
  total: number;
  shown: number;
}

export const FacultyCommandMetrics = function FacultyCommandMetrics({
  total,
  shown,
}: FacultyCommandMetricsProps): React.JSX.Element {
  const { t } = useTranslation();
  const { data: serverMetrics } = useFacultyMetrics();
  const { active: activeStatus, inactive: inactiveStatus } = (() => resolveFacultyStatusRoles())();

  const metrics = (() => ({
    total: serverMetrics?.total ?? total,
    active: serverMetrics?.active ?? 0,
    inactive: serverMetrics?.inactive ?? 0,
    onLeave: serverMetrics?.onLeave ?? 0,
    other: serverMetrics?.other ?? 0,
    newThisPeriod: serverMetrics?.newThisPeriod ?? 0,
  }))();

  const items = (() => [
    {
      icon: School,
      label: t("faculty.metrics.total"),
      value: metrics.total,
      accent: "primary" as const,
    },
    { icon: Filter, label: t("faculty.metrics.filtered"), value: shown, accent: "info" as const },
    {
      icon: UserCheck,
      label: t("faculty.metrics.active"),
      value: metrics.active,
      accent: facultyStatusMetricAccent(activeStatus),
    },
    {
      icon: UserX,
      label: t("faculty.metrics.inactive"),
      value: metrics.inactive,
      accent: facultyStatusMetricAccent(inactiveStatus),
    },
  ])();

  return <ModuleCommandMetricsGrid items={items} />;
};
