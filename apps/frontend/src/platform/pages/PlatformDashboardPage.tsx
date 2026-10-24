import { PlatformOnboardingAction } from "@/platform/components/common/PlatformOnboardingAction";
import React from "react";
import { LayoutDashboard } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import { PlatformDashboard } from "@/platform/components/PlatformDashboard";

export default function PlatformDashboardPage(): React.JSX.Element {
  const { t } = useTranslation();
  const perms = usePlatformPermissions();
  const { platformUser, isSuperUser, canOnboard } = perms;

  const userName = platformUser?.name ?? "";
  const subtitle = isSuperUser
    ? t("platform.consoleSubtitle", { name: userName })
    : t("platform.adminConsoleSubtitle", { name: userName });

  const headerActions = canOnboard ? <PlatformOnboardingAction /> : undefined;

  return (
    <ModulePageShell
      seoTitle={`${t("dashboard.title")} | ${t("platform.consoleTitle")}`}
      seoDescription={subtitle}
      headerIcon={LayoutDashboard}
      headerTitle={t("dashboard.title")}
      headerSubtitle={subtitle}
      headerActions={headerActions}
    >
      <PlatformDashboard />
    </ModulePageShell>
  );
}
