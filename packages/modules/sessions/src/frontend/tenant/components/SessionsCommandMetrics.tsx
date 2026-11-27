import React from "react";
import { Calendar, Filter, CheckCircle2, Clock } from "lucide-react";
import { useTranslation } from "@mms/fe-core/i18n";
import { useSessionsMetrics } from "../hooks/useSessions";
import { ModuleCommandMetricsGrid } from "@mms/fe-core/components/ModuleCommandMetricsGrid";

interface SessionsCommandMetricsProps {
  /** All-session fallback when the metrics endpoint has not supplied a total. */
  total: number;
  /** Total matching the active directory filters (omit off the Work tab). */
  filteredTotal?: number;
}

export const SessionsCommandMetrics = function SessionsCommandMetrics({
  total,
  filteredTotal,
}: SessionsCommandMetricsProps): React.JSX.Element {
  const { t } = useTranslation();
  const { data: serverMetrics, isLoading, isError } = useSessionsMetrics();
  const value = (next: number) => (isLoading ? "—" : next);

  const metrics = (() => ({
    total: serverMetrics?.total ?? total,
    active: serverMetrics?.active ?? 0,
    upcoming: serverMetrics?.upcoming ?? 0,
    completed: serverMetrics?.completed ?? 0,
    cancelled: serverMetrics?.cancelled ?? 0,
    totalEnrolled: serverMetrics?.totalEnrolled ?? 0,
    totalCapacity: serverMetrics?.totalCapacity ?? 0,
  }))();

  const items = (() => [
    {
      icon: Calendar,
      label: t("sessions.metrics.total"),
      value: value(metrics.total),
      sub: isError ? t("sessions.loadFailed") : undefined,
      accent: "primary" as const,
    },
    ...(filteredTotal !== undefined
      ? [
          {
            icon: Filter,
            label: t("sessions.metrics.filtered"),
            value: value(filteredTotal),
            accent: "info" as const,
          },
        ]
      : []),
    {
      icon: CheckCircle2,
      label: t("sessions.metrics.active"),
      value: value(metrics.active),
      accent: "success" as const,
    },
    {
      icon: Clock,
      label: t("sessions.metrics.upcoming"),
      value: value(metrics.upcoming),
      accent: "warning" as const,
    },
  ])();

  return <ModuleCommandMetricsGrid items={items} />;
};
