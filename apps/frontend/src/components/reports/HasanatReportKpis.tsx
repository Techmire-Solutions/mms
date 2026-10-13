import React, { useMemo } from "react";
import { Gift, Star, TrendingDown, Users } from "lucide-react";
import { formatNumber } from "@mms/shared";
import { ModuleCommandMetricsGrid } from "@/components/app/ModuleCommandMetricsGrid";
import { useTranslation } from "@/hooks/useTranslation";

interface HasanatReportKpisProps {
  totalDistributed: number;
  totalRedeemed: number;
  totalBalance: number;
  redemptionRate: string | number;
}

export const HasanatReportKpis = React.memo(function HasanatReportKpis({
  totalDistributed,
  totalRedeemed,
  totalBalance,
  redemptionRate,
}: HasanatReportKpisProps): React.JSX.Element {
  const { t } = useTranslation();

  const items = useMemo(
    () => [
      {
        icon: Star,
        label: t("hasanat.report.totalDistributed"),
        value: formatNumber(totalDistributed),
        accent: "primary" as const,
      },
      {
        icon: Gift,
        label: t("hasanat.report.totalRedeemed"),
        value: formatNumber(totalRedeemed),
        accent: "green" as const,
      },
      {
        icon: TrendingDown,
        label: t("hasanat.report.balance"),
        value: formatNumber(totalBalance),
        accent: "amber" as const,
      },
      {
        icon: Users,
        label: t("hasanat.report.redemptionRate"),
        value: `${redemptionRate}%`,
        accent: "blue" as const,
      },
    ],
    [t, totalDistributed, totalRedeemed, totalBalance, redemptionRate],
  );

  return <ModuleCommandMetricsGrid items={items} />;
});
