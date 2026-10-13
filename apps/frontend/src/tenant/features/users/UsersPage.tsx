import React, { Suspense } from "react";
import { UserCog, Download, Mail, Plus, Upload } from "lucide-react";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import { ResponsiveAccordionTabs } from "@/components/app/ResponsiveAccordionTabs";
import { Button } from "@/components/ui/button";
import { UsersModalLayer } from "@/tenant/features/users/components/UsersModalLayer";
import { UsersCsvImportDialog } from "@/tenant/features/users/components/UsersCsvImportDialog";
import { UsersWorkTier } from "@/tenant/features/users/components/UsersWorkTier";
import { UsersCommandMetrics } from "@/tenant/features/users/components/UsersCommandMetrics";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { CardSkeleton } from "@/components/app/LoadingState";
import { useUsersPageController } from "@/tenant/features/users/hooks/useUsersPageController";

const UsersReportsTier = React.lazy(() =>
  import("@/tenant/features/users/components/UsersReportsTier").then((m) => ({
    default: m.UsersReportsTier,
  })),
);

const UsersSetupTier = React.lazy(() =>
  import("@/tenant/features/users/components/UsersSetupTier").then((m) => ({
    default: m.UsersSetupTier,
  })),
);

/**
 * Users and roles — Work | Reports | Setup.
 */
export default function UsersPage(): React.JSX.Element {
  const controller = useUsersPageController();

  const [importOpen, setImportOpen] = React.useState(false);

  return (
    <ModulePageShell
      seoTitle={`MMS - ${controller.t("page.users.title")}`}
      seoDescription={controller.t("page.users.subtitle")}
      headerIcon={UserCog}
      headerTitle={controller.t("page.users.title")}
      headerSubtitle={controller.t("page.users.subtitle")}
      headerActions={
        controller.effectiveTab === "work" && controller.effectiveSubTab === "users" ? (
          <div className="flex items-center gap-2">
            {controller.canExport ? (
              <Button
                variant="ghost"
                icon={Download}
                onClick={() => {
                  void controller.handleExportCSV();
                }}
              >
                {controller.t("users.exportCsv")}
              </Button>
            ) : null}
            {controller.canWrite && !controller.showDeleted ? (
              <>
                <Button variant="outline" icon={Upload} onClick={() => setImportOpen(true)}>
                  {controller.t("common.import")}
                </Button>
                <Button variant="outline" icon={Mail} onClick={controller.onInviteUser}>
                  {controller.t("users.invite")}
                </Button>
                <Button variant="primary" icon={Plus} onClick={controller.onAddUser}>
                  {controller.t("users.add")}
                </Button>
              </>
            ) : null}
          </div>
        ) : undefined
      }
      metricsStrip={<UsersCommandMetrics shown={controller.shownCount} />}
    >
      <ResponsiveAccordionTabs
        tabs={controller.visibleTopTabs}
        activeTab={controller.effectiveTab}
        onTabChange={controller.setActiveTab}
        hideWhenSingle
        panelIdPrefix="users-tab"
      >
        <ErrorBoundary>
          {controller.effectiveTab === "reports" && (
            <Suspense fallback={<CardSkeleton count={2} />}>
              <UsersReportsTier />
            </Suspense>
          )}
          {controller.effectiveTab === "setup" && (
            <Suspense fallback={<CardSkeleton count={2} />}>
              <UsersSetupTier
                tabs={controller.USERS_CONFIG_TABS}
                activeTab={controller.effectiveConfigTab}
                canEditSetup={controller.canEditSetup}
                onTabChange={controller.setConfigSubTab}
              />
            </Suspense>
          )}
          {controller.effectiveTab === "work" && (
            <div className="space-y-5">
              <UsersWorkTier {...controller.workTierProps} />
            </div>
          )}
        </ErrorBoundary>
      </ResponsiveAccordionTabs>

      <UsersModalLayer {...controller.modalLayerProps} />
      <UsersCsvImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        canWrite={controller.canWrite}
      />
    </ModulePageShell>
  );
}
