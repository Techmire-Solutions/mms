import React from "react";
import { Users, Activity, Settings, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import { Button } from "@shared/ui";
import { PlatformAddAdminForm } from "@/platform/features/users/PlatformAddAdminForm";
import { usePlatformAdmins } from "@/platform/features/users/hooks/usePlatformAdmins";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { usePlatformUserDescriptor } from "@/platform/features/users/hooks/usePlatformUserDescriptor";
import { exportPlatformAdminsCsv } from "@/platform/features/users/components/admin/exportPlatformAdminsCsv";
import { PlatformUsersCommandMetrics } from "@/platform/features/users/components/PlatformUsersCommandMetrics";
import {
  PlatformUsersTier,
  type PlatformUsersSubTab,
} from "@/platform/features/users/components/PlatformUsersTier";
import { usePlatformModuleTabs } from "@/platform/hooks/usePlatformModuleTabs";
import { usePlatformModuleTabState } from "@/platform/hooks/usePlatformModuleTabState";
import { PLATFORM_MODULE_USERS } from "@/platform/lib/platformModuleManifest";
import { ROUTES } from "@/lib/config/routes";

export default function PlatformUsersPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { canSystem, canSettings, isSuperUser } = usePlatformPermissions();
  const { data: admins, isLoading, isError } = usePlatformAdmins();
  const descriptor = usePlatformUserDescriptor();

  const tabs = usePlatformModuleTabs(PLATFORM_MODULE_USERS);
  const { activeTab, handleTabChange } = usePlatformModuleTabState("platform_users_tab", tabs);

  const headerActions = (
    <div className="flex items-center gap-2">
      {canSystem ? (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="min-h-11 gap-1.5 cursor-pointer"
          title={t("platform.viewActivityLogs")}
        >
          <Link to={ROUTES.platformActivityLogs}>
            <Activity className="h-4 w-4" aria-hidden />
            {t("platform.viewActivityLogs")}
          </Link>
        </Button>
      ) : null}
      {activeTab === "setup" && canSettings ? (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="min-h-11 gap-1.5 cursor-pointer"
          title={t("platform.settingsTabSecurity")}
        >
          <Link to={`${ROUTES.platformSettings}?section=security`}>
            <Settings className="h-4 w-4" aria-hidden />
            {t("platform.settingsTabSecurity")}
          </Link>
        </Button>
      ) : null}
      {activeTab === "work" && admins && admins.length > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          icon={Download}
          onClick={() => exportPlatformAdminsCsv(admins, descriptor)}
          title={t("users.exportCsv")}
        >
          {t("users.exportCsv")}
        </Button>
      ) : null}
      {isSuperUser ? <PlatformAddAdminForm asTriggerOnly /> : null}
    </div>
  );

  return (
    <ModulePageShell
      seoTitle={`${t("nav.users")} | ${t("platform.consoleTitle")}`}
      seoDescription={t("platform.adminsSubtitle")}
      headerIcon={Users}
      headerTitle={t("nav.users")}
      headerSubtitle={t("platform.adminsSubtitle")}
      headerActions={headerActions}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      panelIdPrefix="platform-users-tab"
      metricsStrip={
        <PlatformUsersCommandMetrics admins={admins} loading={isLoading} error={isError} />
      }
    >
      <PlatformUsersTier activeTab={activeTab as PlatformUsersSubTab} />
    </ModulePageShell>
  );
}
