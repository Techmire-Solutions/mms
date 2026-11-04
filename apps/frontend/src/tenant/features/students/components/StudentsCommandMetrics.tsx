import React from "react";
import { GraduationCap, Filter, UserCheck, UserX, UserPlus } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { ModuleCommandMetricsGrid } from "@/components/app/ModuleCommandMetricsGrid";
import type { StudentsCommandMetricsSnapshot } from "@mms/shared";

export interface StudentsCommandMetricsProps {
  total: number;
  shown: number;
  /** Pass the full metrics snapshot from the page controller to avoid a duplicate query. */
  serverMetrics?: StudentsCommandMetricsSnapshot | null;
  /** Metrics request in flight: show the unknown sentinel instead of zeros/row counts. */
  isLoading?: boolean;
  /** Metrics request failed: show an inline retry instead of authoritative-looking zeros. */
  isError?: boolean;
  onRetry?: () => void;
}

const UNKNOWN = "—";

export const StudentsCommandMetrics = function StudentsCommandMetrics({
  total,
  shown,
  serverMetrics,
  isLoading = false,
  isError = false,
  onRetry,
}: StudentsCommandMetricsProps): React.JSX.Element {
  const { t } = useTranslation();

  // 2026-11-04 review (n1/X-05): a loading or failed metrics query used to render
  // `shownCount` as "Total" and hard zeros for the other tiles — authoritative-looking
  // numbers that were simply unknown.
  const unknownMetrics = isLoading || isError || serverMetrics == null;
  const metrics = (() => ({
    total: serverMetrics?.total ?? (unknownMetrics ? UNKNOWN : total),
    active: serverMetrics?.active ?? (isLoading ? UNKNOWN : "0"),
    inactive: serverMetrics?.inactive ?? (isLoading ? UNKNOWN : "0"),
    newThisPeriod: serverMetrics?.newThisPeriod ?? (isLoading ? UNKNOWN : "0"),
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

  return (
    <div className="space-y-2" aria-busy={isLoading || undefined}>
      {isError ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          <span>{t("students.loadFailed")}</span>
          {onRetry ? (
            <Button variant="outline" size="sm" className="min-h-11" onClick={onRetry}>
              {t("common.retry")}
            </Button>
          ) : null}
        </div>
      ) : null}
      <ModuleCommandMetricsGrid items={items} />
    </div>
  );
};
