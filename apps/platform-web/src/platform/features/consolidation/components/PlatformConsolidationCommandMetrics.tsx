import React from "react";
import { Layers, Users } from "lucide-react";
import { useTranslation } from "@mms/fe-core/i18n";
import { ModuleCommandMetricsGrid } from "@mms/fe-core/components/ModuleCommandMetricsGrid";
import { StatsSkeleton } from "@mms/ui";
import { useConsolidationGroups } from "@/platform/features/consolidation/hooks/usePlatformConsolidation";

/** Consolidation command metrics strip (group + member counts, visible across all tiers). */
export function PlatformConsolidationCommandMetrics(): React.JSX.Element | null {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useConsolidationGroups();

  if (isError) return null;
  if (isLoading || !data) return <StatsSkeleton count={2} />;

  const totalMembers = data.reduce((sum, group) => sum + group.members.length, 0);

  return (
    <ModuleCommandMetricsGrid
      items={[
        {
          icon: Layers,
          label: t("platform.consolidation.groups"),
          value: data.length,
          accent: "primary",
        },
        {
          icon: Users,
          label: t("platform.consolidation.members"),
          value: totalMembers,
          accent: "info",
        },
      ]}
    />
  );
}
