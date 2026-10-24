import React from "react";
import { Receipt, Filter, Banknote, Wallet } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useObligationsMetrics } from "@/tenant/features/obligations/hooks/useObligationsApi";
import { ModuleCommandMetricsGrid } from "@/components/app/ModuleCommandMetricsGrid";
import { useFinanceCurrency } from "@/hooks/useCurrency";

interface ObligationsCommandMetricsProps {
  total: number;
  shown: number;
}

export const ObligationsCommandMetrics = function ObligationsCommandMetrics({
  total,
  shown,
}: ObligationsCommandMetricsProps): React.JSX.Element {
  const { t } = useTranslation();
  const { data: serverMetrics } = useObligationsMetrics();
  const { formatCurrency } = useFinanceCurrency();

  const metrics = (() => ({
    total: serverMetrics?.total ?? total,
    totalAmount: serverMetrics?.totalAmount ?? 0,
    cash: serverMetrics?.cash ?? 0,
    online: serverMetrics?.online ?? 0,
    newThisPeriod: serverMetrics?.newThisPeriod ?? 0,
    obligationTypes: serverMetrics?.obligationTypes ?? 0,
  }))();

  const items = (() => [
    {
      icon: Receipt,
      label: t("obligations.metrics.total"),
      value: metrics.total,
      accent: "primary" as const,
    },
    {
      icon: Filter,
      label: t("obligations.metrics.filtered"),
      value: shown,
      accent: "info" as const,
    },
    {
      icon: Banknote,
      label: t("obligations.metrics.totalAmount"),
      value: formatCurrency(metrics.totalAmount),
      accent: "indigo" as const,
    },
    {
      icon: Wallet,
      label: t("obligations.metrics.cash"),
      value: metrics.cash,
      accent: "success" as const,
    },
  ])();

  return <ModuleCommandMetricsGrid items={items} />;
};
