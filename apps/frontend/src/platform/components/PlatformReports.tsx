import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { formatDate } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Button } from "@/components/ui/button";
import { ExportToolbar, type ExportColumn } from "@/components/app/ExportToolbar";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { usePlatformWorkspaces } from "@/platform/hooks/usePlatformWorkspaces";
import { containerVariantsConsole, itemVariants } from "@/platform/lib/animations";
import { PlatformReportsMetrics } from "./reports/PlatformReportsMetrics";
import { PlatformReportsGrowthChart } from "./reports/PlatformReportsGrowthChart";
import { PlatformReportsPieCharts } from "./reports/PlatformReportsPieCharts";
import { PlatformReportsOperatorCard } from "./reports/PlatformReportsOperatorCard";
import { PlatformReportsModuleAdoption } from "./reports/PlatformReportsModuleAdoption";
import { exportPlatformReportsCsv } from "./reports/exportPlatformReportsCsv";

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
    <motion.div
      variants={reducedMotion ? undefined : containerVariantsConsole}
      initial={reducedMotion ? false : "hidden"}
      animate="show"
      className="space-y-6 text-start"
    >
      <motion.div
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
      </motion.div>
      <motion.div variants={reducedMotion ? undefined : itemVariants}>
        <PlatformReportsMetrics
          totalWorkspaces={totalWorkspaces}
          activeWorkspaces={activeWorkspaces}
          activeRate={activeRate}
          platformUser={platformUser}
          isReady={metricsReady}
          isError={workspacesError}
        />
      </motion.div>

      <motion.div variants={reducedMotion ? undefined : itemVariants}>
        <PlatformReportsGrowthChart workspaces={workspaces} />
      </motion.div>

      <motion.div variants={reducedMotion ? undefined : itemVariants}>
        <PlatformReportsPieCharts
          totalWorkspaces={totalWorkspaces}
          activeWorkspaces={activeWorkspaces}
          disabledWorkspaces={disabledWorkspaces}
          verifyRequiredCount={verifyRequiredCount}
          verifyOptionalCount={verifyOptionalCount}
        />
      </motion.div>

      <motion.div variants={reducedMotion ? undefined : itemVariants}>
        <PlatformReportsModuleAdoption />
      </motion.div>

      <motion.div variants={reducedMotion ? undefined : itemVariants}>
        <PlatformReportsOperatorCard
          platformUser={platformUser}
          isSuperUser={isSuperUser}
          canWorkspaces={canWorkspaces}
          canOnboard={canOnboard}
          canSettings={canSettings}
          canAdmins={canAdmins}
          canSystem={canSystem}
        />
      </motion.div>
    </motion.div>
  );
}
