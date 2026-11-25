import React, { useMemo } from "react";
import { m } from "framer-motion";
import { Download } from "lucide-react";
import { formatDate } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { useReducedMotion } from "@mms/ui/app/useReducedMotion";
import { Button } from "@mms/ui";
import { ExportToolbar, type ExportColumn } from "@mms/fe-core/components/ExportToolbar";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { usePlatformWorkspaces } from "@/platform/features/workspaces/hooks/usePlatformWorkspaces";
import { containerVariantsConsole, itemVariants } from "@/lib/motion";
import { PlatformReportsMetrics } from "@/platform/features/reports/components/PlatformReportsMetrics";
import { PlatformReportsGrowthChart } from "@/platform/features/reports/components/PlatformReportsGrowthChart";
import { PlatformReportsPieCharts } from "@/platform/features/reports/components/PlatformReportsPieCharts";
import { PlatformReportsOperatorCard } from "@/platform/features/reports/components/PlatformReportsOperatorCard";
import { PlatformReportsModuleAdoption } from "@/platform/features/reports/components/PlatformReportsModuleAdoption";
import { exportPlatformReportsCsv } from "@/platform/features/reports/lib/exportPlatformReportsCsv";

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: "Subdomain", key: "subdomain" },
  { header: "Madrasa Name", key: "madrasaName" },
  { header: "Status", key: "status" },
  { header: "Email Verification", key: "verification" },
  { header: "Admin Email", key: "adminEmail" },
  { header: "Created At", key: "createdAt" },
];

export function PlatformReports(): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const {
    platformUser,
    isSuperUser,
    canWorkspaces,
    canOnboard,
    canSettings,
    canAdmins,
    canSystem,
  } = usePlatformPermissions();
  const {
    data: workspaces,
    isLoading: workspacesLoading,
    isError: workspacesError,
  } = usePlatformWorkspaces({ limit: 100 });

  const totalWorkspaces = workspaces?.length ?? 0;
  const activeWorkspaces = workspaces?.filter((w) => w.enabled).length ?? 0;
  const disabledWorkspaces = workspaces?.filter((w) => w.enabled === false).length ?? 0;
  const verifyRequiredCount =
    workspaces?.filter((w) => Boolean(w.requireEmailVerification)).length ?? 0;
  const verifyOptionalCount = totalWorkspaces - verifyRequiredCount;
  const activeRate =
    totalWorkspaces > 0 ? Math.round((activeWorkspaces / totalWorkspaces) * 100) : 0;
  const metricsReady = !workspacesLoading && !workspacesError && workspaces !== undefined;

  const exportRows = useMemo(
    () =>
      workspaces?.map((w) => ({
        subdomain: w.subdomain,
        madrasaName: w.madrasaName,
        status: w.enabled ? "Active" : "Disabled",
        verification: w.requireEmailVerification ? "Required" : "Optional",
        adminEmail: w.adminEmail || "—",
        createdAt: w.createdAt ? formatDate(w.createdAt) : "—",
      })) ?? [],
    [workspaces],
  );

  return (
    <m.div
      variants={reducedMotion ? undefined : containerVariantsConsole}
      initial={reducedMotion ? false : "hidden"}
      animate="visible"
      className="space-y-6 text-start"
    >
      <m.div
        variants={reducedMotion ? undefined : itemVariants}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4"
      >
        <div>
          <h2 className="text-lg font-bold text-foreground text-balance">{t("module.reports")}</h2>
          <p className="text-xs text-muted-foreground">{t("platform.reports.growthTrendSub")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportToolbar
            title={t("module.reports")}
            filename="platform_analytics"
            moduleId="platform"
            columns={EXPORT_COLUMNS}
            rows={exportRows}
            variant="compact"
          />
          <Button
            variant="outline"
            size="sm"
            icon={Download}
            onClick={() =>
              exportPlatformReportsCsv(workspaces, {
                totalWorkspaces,
                activeWorkspaces,
                disabledWorkspaces,
                activeRate,
                verifyRequiredCount,
                verifyOptionalCount,
              })
            }
            disabled={!metricsReady || totalWorkspaces === 0}
            title={t("platform.reports.exportCsv")}
          >
            {t("platform.reports.exportCsv")}
          </Button>
        </div>
      </m.div>
      <m.div variants={reducedMotion ? undefined : itemVariants}>
        <PlatformReportsMetrics
          totalWorkspaces={totalWorkspaces}
          activeWorkspaces={activeWorkspaces}
          activeRate={activeRate}
          platformUser={platformUser}
          isReady={metricsReady}
          isError={workspacesError}
        />
      </m.div>

      <m.div variants={reducedMotion ? undefined : itemVariants}>
        <PlatformReportsGrowthChart workspaces={workspaces} />
      </m.div>

      <m.div variants={reducedMotion ? undefined : itemVariants}>
        <PlatformReportsPieCharts
          totalWorkspaces={totalWorkspaces}
          activeWorkspaces={activeWorkspaces}
          disabledWorkspaces={disabledWorkspaces}
          verifyRequiredCount={verifyRequiredCount}
          verifyOptionalCount={verifyOptionalCount}
        />
      </m.div>

      <m.div variants={reducedMotion ? undefined : itemVariants}>
        <PlatformReportsModuleAdoption />
      </m.div>

      <m.div variants={reducedMotion ? undefined : itemVariants}>
        <PlatformReportsOperatorCard
          platformUser={platformUser}
          isSuperUser={isSuperUser}
          canWorkspaces={canWorkspaces}
          canOnboard={canOnboard}
          canSettings={canSettings}
          canAdmins={canAdmins}
          canSystem={canSystem}
        />
      </m.div>
    </m.div>
  );
}
