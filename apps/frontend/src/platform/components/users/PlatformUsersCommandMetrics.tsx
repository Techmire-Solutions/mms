import { getPlatformAdminMetrics } from "@/platform/lib/platformAdminMetrics";
import React from "react";
import { ShieldCheck, UserCheck, Crown } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { ModuleCommandMetricsGrid } from "@/components/ui/ModuleCommandMetricsGrid";
import { StatsSkeleton } from "@/components/ui/LoadingState";
import type { PlatformUserProfile } from "@mms/shared";

export interface PlatformUsersCommandMetricsProps {
  admins: PlatformUserProfile[] | undefined;
  loading: boolean;
  error: boolean;
}

export function PlatformUsersCommandMetrics({
  admins,
  loading,
  error,
}: PlatformUsersCommandMetricsProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (error) return null;
  if (loading || !admins) {
    return <StatsSkeleton count={3} />;
  }

  const { total, active, superUsers } = getPlatformAdminMetrics(admins);

  return (
    <ModuleCommandMetricsGrid
      items={[
        {
          icon: ShieldCheck,
          label: t("platform.manageAdmins"),
          value: total,
          accent: "primary",
        },
        {
          icon: UserCheck,
          label: t("platform.workspaceActive"),
          value: active,
          accent: "success",
        },
        {
          icon: Crown,
          label: t("platform.roleSuperUser"),
          value: superUsers,
          accent: "warning",
        },
      ]}
    />
  );
}
