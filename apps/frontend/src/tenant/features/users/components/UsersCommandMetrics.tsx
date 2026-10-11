import React from "react";
import { Users as UsersIcon, ShieldAlert, UserCheck } from "lucide-react";
import type { UsersCommandMetricsSnapshot } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { ModuleCommandMetricsGrid } from "@/components/ui/ModuleCommandMetricsGrid";
import { useUsersMetrics } from "@/tenant/features/users/hooks/useUsersApi";

interface UsersCommandMetricsProps {
  shown: number;
}

export const UsersCommandMetrics = function UsersCommandMetrics({
  shown,
}: UsersCommandMetricsProps): React.JSX.Element {
  const { t } = useTranslation();
  const { data: metrics } = useUsersMetrics();

  const snapshot: UsersCommandMetricsSnapshot = (() =>
    metrics ?? {
      total: 0,
      active: 0,
      suspended: 0,
      admins: 0,
      twoFaEnabled: 0,
      activeSessions: 0,
    })();

  const items = (() => [
    {
      icon: UsersIcon,
      label: t("users.stats.total"),
      value: snapshot.total,
      accent: "primary" as const,
    },
    {
      icon: UsersIcon,
      label: t("users.stats.filtered"),
      value: shown,
      accent: "info" as const,
    },
    {
      icon: UserCheck,
      label: t("users.status.active"),
      value: snapshot.active,
      accent: "success" as const,
    },
    {
      icon: ShieldAlert,
      label: t("users.status.suspended"),
      value: snapshot.suspended,
      accent: "destructive" as const,
    },
  ])();

  return <ModuleCommandMetricsGrid items={items} />;
};
