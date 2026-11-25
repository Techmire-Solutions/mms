import React from "react";
import { Building2, CheckCircle2, CircleOff } from "lucide-react";
import { useTranslation } from "@mms/fe-core/i18n";
import { ModuleCommandMetricsGrid } from "@mms/fe-core/components/ModuleCommandMetricsGrid";
import { StatsSkeleton } from "@mms/ui";
import { usePlatformWorkspaceMetrics } from "@/platform/features/workspaces/hooks/usePlatformWorkspaceMetrics";

/** Workspaces command metrics strip (fleet KPIs, visible across all tiers). */
export function PlatformWorkspacesCommandMetrics(): React.JSX.Element | null {
  const { t } = useTranslation();
  const { data, isLoading, isError } = usePlatformWorkspaceMetrics();

  if (isError) return null;
  if (isLoading || !data) return <StatsSkeleton count={3} />;

  return (
    <ModuleCommandMetricsGrid
      items={[
        {
          icon: Building2,
          label: t("platform.workspaceTotal"),
          value: data.total,
          accent: "primary",
        },
        {
          icon: CheckCircle2,
          label: t("platform.workspaceActive"),
          value: data.active,
          accent: "success",
        },
        {
          icon: CircleOff,
          label: t("platform.workspaceInactive"),
          value: data.inactive,
          accent: "muted",
        },
      ]}
    />
  );
}
