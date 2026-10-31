import React, { useMemo } from "react";
import { Building2, Globe, Ban, PlusCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { usePlatformWorkspaceMetrics } from "@/platform/hooks/usePlatformWorkspaceMetrics";
import { usePlatformActivityTrend } from "@/platform/hooks/usePlatformTelemetry";
import { ModuleCommandMetricsGrid } from "@/components/app/ModuleCommandMetricsGrid";
import { Button, EmptyState, ErrorState, StatsSkeleton } from "@shared/ui";
import { containerVariantsConsole, itemVariants } from "@/platform/lib/animations";
import { PlatformDashboardBanner } from "./dashboard/PlatformDashboardBanner";
import { PlatformDashboardTelemetry } from "./dashboard/PlatformDashboardTelemetry";
import { PlatformDashboardCharts } from "./dashboard/PlatformDashboardCharts";
import { PlatformDashboardQuickActions } from "./dashboard/PlatformDashboardQuickActions";
import { PlatformDashboardFleet } from "./dashboard/PlatformDashboardFleet";
import { ROUTES } from "@/lib/config/routes";

export function PlatformDashboard(): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const { platformUser, isSuperUser, canWorkspaces, canOnboard, canSystem, canAdmins } =
    usePlatformPermissions();
  const {
    data: metrics,
    isLoading: metricsLoading,
    isError: metricsError,
    refetch,
  } = usePlatformWorkspaceMetrics();
  const { data: activityTrend } = usePlatformActivityTrend();

  const totalWorkspaces = metrics?.total ?? 0;
  const activeWorkspaces = metrics?.active ?? 0;
  const disabledWorkspaces = metrics?.inactive ?? 0;
  const metricsReady = !metricsLoading && !metricsError && metrics !== undefined;

  const sparkline = useMemo(() => (activityTrend ?? []).map((d) => d.ops ?? 0), [activityTrend]);
  const trendDelta = useMemo(() => {
    if (sparkline.length < 2) return undefined;
    const prev = sparkline[sparkline.length - 2] ?? 0;
    const last = sparkline[sparkline.length - 1] ?? 0;
    if (prev === 0) return last > 0 ? 100 : 0;
    return Math.round(((last - prev) / prev) * 100);
  }, [sparkline]);

  return (
    <motion.div
      variants={reducedMotion ? undefined : containerVariantsConsole}
      initial={reducedMotion ? false : "hidden"}
      animate="show"
      className="space-y-8 text-start"
    >
      <PlatformDashboardBanner
        platformUser={platformUser}
        isSuperUser={isSuperUser}
        canWorkspaces={canWorkspaces}
      />

      <motion.div variants={reducedMotion ? undefined : itemVariants}>
        {metricsError ? (
          <ErrorState
            title={t("platform.loadFailed")}
            description={t("platform.loadFailedHint")}
            onRetry={() => void refetch()}
          />
        ) : metricsReady && totalWorkspaces === 0 && canOnboard ? (
          <EmptyState
            icon={Building2}
            title={t("apex.noMadrasasYet")}
            description={t("platform.superConsoleDesc")}
            action={
              <Button asChild className="min-h-11 rounded-xl font-bold px-5 cursor-pointer">
                <Link to={ROUTES.onboarding}>
                  <PlusCircle className="w-4 h-4 me-1.5" aria-hidden />
                  {t("auth.createMadrasa")}
                </Link>
              </Button>
            }
          />
        ) : metricsReady ? (
          <ModuleCommandMetricsGrid
            items={[
              {
                icon: Building2,
                label: t("platform.manageMadrasas"),
                value: totalWorkspaces,
                accent: "primary",
                sparklineData: sparkline.length > 1 ? sparkline : undefined,
                trend: trendDelta,
                trendLabel: t("platform.vsPriorPeriod"),
              },
              {
                icon: Globe,
                label: t("platform.workspaceActive"),
                value: activeWorkspaces,
                accent: "success",
              },
              {
                icon: Ban,
                label: t("platform.workspaceInactive"),
                value: disabledWorkspaces,
                accent: "destructive",
              },
            ]}
          />
        ) : (
          <StatsSkeleton count={3} />
        )}
      </motion.div>

      {metricsReady && totalWorkspaces > 0 ? (
        <motion.div variants={reducedMotion ? undefined : itemVariants}>
          <PlatformDashboardFleet />
        </motion.div>
      ) : null}

      {metricsReady && totalWorkspaces > 0 ? (
        <motion.div
          variants={reducedMotion ? undefined : itemVariants}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start"
        >
          <div className="lg:col-span-2 space-y-6">
            <PlatformDashboardCharts
              activeWorkspaces={activeWorkspaces}
              disabledWorkspaces={disabledWorkspaces}
            />
          </div>
          <PlatformDashboardQuickActions
            canWorkspaces={canWorkspaces}
            canSystem={canSystem}
            canAdmins={canAdmins}
          />
        </motion.div>
      ) : null}

      <motion.div variants={reducedMotion ? undefined : itemVariants}>
        <PlatformDashboardTelemetry />
      </motion.div>
    </motion.div>
  );
}
