import React from "react";
import { GraduationCap, Filter, UserCheck, UserX, UserPlus } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { ModuleCommandMetricsGrid } from "@/components/ui/ModuleCommandMetricsGrid";
import type { StudentsCommandMetricsSnapshot } from "@mms/shared";

export interface StudentsCommandMetricsProps {
  total: number;
  shown: number;
  /** Pass the full metrics snapshot from the page controller to avoid a duplicate query. */
  serverMetrics?: StudentsCommandMetricsSnapshot | null;
}

export const StudentsCommandMetrics = function StudentsCommandMetrics({
  total,
  shown,
  serverMetrics,
}: StudentsCommandMetricsProps): React.JSX.Element {
  const { t } = useTranslation();

  const metrics = (() => ({
    total: serverMetrics?.total ?? total,
    active: serverMetrics?.active ?? 0,
    inactive: serverMetrics?.inactive ?? 0,
    newThisPeriod: serverMetrics?.newThisPeriod ?? 0,
  }))();

  const items = (() => [
    {
      icon: GraduationCap,
      label: t("students.metrics.total"),
      value: metrics.total,
      accent: "primary" as const,
    },
    { icon: Filter, label: t("students.metrics.filtered"), value: shown, accent: "info" as const },
    {
      icon: UserCheck,
      label: t("students.metrics.active"),
      value: metrics.active,
      accent: "success" as const,
    },
    {
      icon: UserX,
      label: t("students.metrics.inactive"),
      value: metrics.inactive,
      accent: "warning" as const,
    },
    {
      icon: UserPlus,
      label: t("students.metrics.newThisPeriod"),
      value: metrics.newThisPeriod,
      accent: "secondary" as const,
    },
  ])();

  return <ModuleCommandMetricsGrid items={items} />;
};
