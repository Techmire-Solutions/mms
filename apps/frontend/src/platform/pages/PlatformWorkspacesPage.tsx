import { PlatformOnboardingAction } from "@/platform/components/common/PlatformOnboardingAction";
import React from "react";
import { Building2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import PlatformWorkspaceList from "@/platform/components/PlatformWorkspaceList";

export default function PlatformWorkspacesPage(): React.JSX.Element {
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
      seoTitle={`${t("platform.manageMadrasas")} | ${t("platform.consoleTitle")}`}
      seoDescription={subtitle}
      headerIcon={Building2}
      headerTitle={t("platform.manageMadrasas")}
      headerSubtitle={subtitle}
      headerActions={headerActions}
    >
      <PlatformWorkspaceList />
    </ModulePageShell>
  );
}
