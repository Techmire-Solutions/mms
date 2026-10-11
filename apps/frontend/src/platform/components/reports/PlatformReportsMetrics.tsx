import React from "react";
import { Globe, TrendingUp, ShieldCheck } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { ModuleCommandMetricsGrid } from "@/components/ui/ModuleCommandMetricsGrid";
import { StatsSkeleton } from "@/components/ui/LoadingState";
import type { PlatformUser } from "@mms/shared";

interface PlatformReportsMetricsProps {
  totalWorkspaces: number;
  activeWorkspaces: number;
  activeRate: number;
  platformUser?: PlatformUser | null;
  isReady: boolean;
  isError: boolean;
}

export function PlatformReportsMetrics({
  totalWorkspaces,
  activeWorkspaces,
  activeRate,
  platformUser,
  isReady,
  isError,
}: PlatformReportsMetricsProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (isError) return null;
  if (!isReady) return <StatsSkeleton count={3} />;

  return (
    <ModuleCommandMetricsGrid
      items={[
        {
          icon: Globe,
          label: t("platform.workspaceActive"),
          value: `${activeWorkspaces} / ${totalWorkspaces}`,
          accent: "primary",
        },
        {
          icon: TrendingUp,
          label: t("platform.activationRate"),
          value: `${activeRate}%`,
          accent: "success",
        },
        {
          icon: ShieldCheck,
          label: t("platform.roleSuperUser"),
          value: platformUser?.name ?? t("platform.operatorRole"),
          accent: "warning",
        },
      ]}
    />
  );
}
