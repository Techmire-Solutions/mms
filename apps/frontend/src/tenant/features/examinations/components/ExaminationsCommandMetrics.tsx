import React from "react";
import { BookOpen, Filter, Clock, PlayCircle } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useExaminationsMetrics } from "@/tenant/features/examinations/hooks/useExaminationsApi";
import { ModuleCommandMetricsGrid } from "@/components/ui/ModuleCommandMetricsGrid";

export interface ExaminationsCommandMetricsProps {
  shown: number;
  total: number;
}

export const ExaminationsCommandMetrics = function ExaminationsCommandMetrics({
  shown,
  total,
}: ExaminationsCommandMetricsProps): React.JSX.Element {
  const { t } = useTranslation();
  const { data: serverMetrics } = useExaminationsMetrics();

  const metrics = (() => ({
    total: serverMetrics?.total ?? total,
    upcoming: serverMetrics?.upcoming ?? 0,
    ongoing: serverMetrics?.ongoing ?? 0,
    completed: serverMetrics?.completed ?? 0,
    totalResults: serverMetrics?.totalResults ?? 0,
    examsWithResults: serverMetrics?.examsWithResults ?? 0,
  }))();

  const items = (() => [
    {
      icon: BookOpen,
      label: t("examinations.metrics.total"),
      value: metrics.total,
      accent: "primary" as const,
    },
    {
      icon: Filter,
      label: t("examinations.metrics.filtered"),
      value: shown,
      accent: "info" as const,
    },
    {
      icon: Clock,
      label: t("examinations.metrics.upcoming"),
      value: metrics.upcoming,
      accent: "warning" as const,
    },
    {
      icon: PlayCircle,
      label: t("examinations.metrics.ongoing"),
      value: metrics.ongoing,
      accent: "indigo" as const,
    },
  ])();

  return <ModuleCommandMetricsGrid items={items} />;
};
