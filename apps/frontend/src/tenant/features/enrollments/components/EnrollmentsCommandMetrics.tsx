import React from "react";
import { ClipboardList, Filter, CheckCircle2, Clock } from "lucide-react";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { useTranslation } from "@/hooks/useTranslation";
import { useEnrollmentsMetrics } from "@/tenant/features/enrollments/hooks/useEnrollmentsApi";
import { ModuleCommandMetricsGrid } from "@/components/app/ModuleCommandMetricsGrid";

interface EnrollmentsCommandMetricsProps {
  total: number;
  shown: number;
}

export const EnrollmentsCommandMetrics = function EnrollmentsCommandMetrics({
  total,
  shown,
}: EnrollmentsCommandMetricsProps): React.JSX.Element {
  const { t } = useTranslation();
  const { formatCurrency: _formatCurrency, activeCurrency: _activeCurrency } = useFinanceCurrency();
  const { data: serverMetrics } = useEnrollmentsMetrics();

  const metrics = (() => ({
    total: serverMetrics?.total ?? total,
    confirmed: serverMetrics?.confirmed ?? 0,
    pending: serverMetrics?.pending ?? 0,
    cancelled: serverMetrics?.cancelled ?? 0,
    revenue: serverMetrics?.revenue ?? 0,
    newThisPeriod: serverMetrics?.newThisPeriod ?? 0,
  }))();

  const items = (() => [
    {
      icon: ClipboardList,
      label: t("enrollments.metrics.total"),
      value: metrics.total,
      accent: "primary" as const,
    },
    {
      icon: Filter,
      label: t("enrollments.metrics.filtered"),
      value: shown,
      accent: "info" as const,
    },
    {
      icon: CheckCircle2,
      label: t("enrollments.metrics.confirmed"),
      value: metrics.confirmed,
      accent: "success" as const,
    },
    {
      icon: Clock,
      label: t("enrollments.metrics.pending"),
      value: metrics.pending,
      accent: "warning" as const,
    },
  ])();

  return <ModuleCommandMetricsGrid items={items} />;
};
