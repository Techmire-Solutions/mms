import React from "react";
import { Layers, Filter, Package, Star, Gift, TrendingUp, RotateCcw } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useHasanatMetrics } from "@/tenant/features/hasanat/hooks/useHasanatApi";
import { ModuleCommandMetricsGrid } from "@/components/ui/ModuleCommandMetricsGrid";

interface HasanatCommandMetricsProps {
  shown: number;
}

export const HasanatCommandMetrics = function HasanatCommandMetrics({
  shown,
}: HasanatCommandMetricsProps): React.JSX.Element {
  const { t } = useTranslation();
  const { data: serverMetrics } = useHasanatMetrics();

  const metrics = (() => ({
    totalStock: serverMetrics?.totalStock ?? 0,
    available: serverMetrics?.available ?? 0,
    distributed: serverMetrics?.distributed ?? 0,
    redeemed: serverMetrics?.redeemed ?? 0,
    active: serverMetrics?.active ?? 0,
    returned: serverMetrics?.returned ?? 0,
    denominations: serverMetrics?.denominations ?? 0,
  }))();

  const items = (() => [
    {
      icon: Layers,
      label: t("hasanat.metrics.totalStock"),
      value: metrics.totalStock,
      accent: "primary" as const,
    },
    { icon: Filter, label: t("hasanat.metrics.filtered"), value: shown, accent: "info" as const },
    {
      icon: Package,
      label: t("hasanat.metrics.available"),
      value: metrics.available,
      accent: "success" as const,
    },
    {
      icon: Star,
      label: t("hasanat.metrics.distributed"),
      value: metrics.distributed,
      accent: "indigo" as const,
    },
    {
      icon: Gift,
      label: t("hasanat.metrics.redeemed"),
      value: metrics.redeemed,
      accent: "teal" as const,
    },
    {
      icon: TrendingUp,
      label: t("hasanat.metrics.active"),
      value: metrics.active,
      accent: "success" as const,
    },
    {
      icon: RotateCcw,
      label: t("hasanat.metrics.returned"),
      value: metrics.returned,
      accent: "warning" as const,
    },
  ])();

  return <ModuleCommandMetricsGrid items={items} />;
};
