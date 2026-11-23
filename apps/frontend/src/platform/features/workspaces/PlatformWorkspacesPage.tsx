import React from "react";
import { Building2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import { PlatformOnboardingAction } from "@/platform/features/shell/components/common/PlatformOnboardingAction";
import { PlatformWorkspacesCommandMetrics } from "@/platform/features/workspaces/components/PlatformWorkspacesCommandMetrics";
import {
  PlatformWorkspacesTier,
  type PlatformWorkspacesTab,
} from "@/platform/features/workspaces/components/PlatformWorkspacesTier";
import { usePlatformModuleTabs } from "@/platform/hooks/usePlatformModuleTabs";
import { usePlatformModuleTabState } from "@/platform/hooks/usePlatformModuleTabState";
import { PLATFORM_MODULE_WORKSPACES } from "@/platform/lib/platformModuleManifest";

export default function PlatformWorkspacesPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { platformUser, isSuperUser, canOnboard } = usePlatformPermissions();

  const userName = platformUser?.name ?? "";
  const subtitle = isSuperUser
    ? t("platform.consoleSubtitle", { name: userName })
    : t("platform.adminConsoleSubtitle", { name: userName });

  const tabs = usePlatformModuleTabs(PLATFORM_MODULE_WORKSPACES);
  const { activeTab, handleTabChange } = usePlatformModuleTabState("platform_workspaces_tab", tabs);

  const headerActions = canOnboard ? <PlatformOnboardingAction /> : undefined;

  return (
    <ModulePageShell
      seoTitle={`${t("platform.manageMadrasas")} | ${t("platform.consoleTitle")}`}
      seoDescription={subtitle}
      headerIcon={Building2}
      headerTitle={t("platform.manageMadrasas")}
      headerSubtitle={subtitle}
      headerActions={headerActions}
      metricsStrip={<PlatformWorkspacesCommandMetrics />}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      panelIdPrefix="platform-workspaces-tab"
    >
      <PlatformWorkspacesTier activeTab={activeTab as PlatformWorkspacesTab} />
    </ModulePageShell>
  );
}
