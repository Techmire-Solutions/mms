import React from "react";
import { Link } from "react-router-dom";
import { Activity, Building2, BarChart3, Server, UserPlus, Settings } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { WidgetCard } from "@/components/app/WidgetCard";
import { WidgetCardHeader } from "@/components/app/WidgetCardHeader";
import { ROUTES } from "@/lib/config/routes";

export interface PlatformDashboardQuickActionsProps {
  canWorkspaces: boolean;
  canSystem: boolean;
  canAdmins: boolean;
}

export function PlatformDashboardQuickActions({
  canWorkspaces,
  canSystem,
  canAdmins,
}: PlatformDashboardQuickActionsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <WidgetCard className="p-6 space-y-4 rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm shadow-xs">
      <WidgetCardHeader
        icon={<Activity className="w-4 h-4 text-primary" />}
        title={t("platform.quickActionsTitle")}
        subtitle={t("platform.quickActionsSubtitle")}
      />

      <div className="space-y-2.5 pt-1">
        {canWorkspaces && (
          <Button
            asChild
            variant="outline"
            className="w-full justify-start min-h-11 rounded-xl font-bold text-xs gap-2.5 hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-all shadow-2xs cursor-pointer"
          >
            <Link to={ROUTES.platformWorkspaces}>
              <Building2 className="w-4 h-4 text-primary shrink-0" aria-hidden />
              {t("platform.manageMadrasas")}
            </Link>
          </Button>
        )}

        {canWorkspaces && (
          <Button
            asChild
            variant="outline"
            className="w-full justify-start min-h-11 rounded-xl font-bold text-xs gap-2.5 hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-all shadow-2xs cursor-pointer"
          >
            <Link to={ROUTES.platformReports}>
              <BarChart3 className="w-4 h-4 text-primary shrink-0" aria-hidden />
              {t("module.reports")}
            </Link>
          </Button>
        )}

        {canSystem && (
          <Button
            asChild
            variant="outline"
            className="w-full justify-start min-h-11 rounded-xl font-bold text-xs gap-2.5 hover:bg-secondary/20 hover:text-secondary-foreground hover:border-secondary/40 transition-all shadow-2xs cursor-pointer"
          >
            <Link to={ROUTES.platformActivityLogs}>
              <Activity className="w-4 h-4 text-secondary shrink-0" aria-hidden />
              {t("platform.activityLogsTitle")}
            </Link>
          </Button>
        )}

        {canSystem && (
          <Button
            asChild
            variant="outline"
            className="w-full justify-start min-h-11 rounded-xl font-bold text-xs gap-2.5 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-all shadow-2xs cursor-pointer"
          >
            <Link to={ROUTES.platformSystem}>
              <Server className="w-4 h-4 text-destructive shrink-0" aria-hidden />
              {t("platform.systemMaintenance")}
            </Link>
          </Button>
        )}

        {canAdmins && (
          <Button
            asChild
            variant="outline"
            className="w-full justify-start min-h-11 rounded-xl font-bold text-xs gap-2.5 hover:bg-success/10 hover:text-success hover:border-success/40 transition-all shadow-2xs cursor-pointer"
          >
            <Link to={ROUTES.platformUsers}>
              <UserPlus className="w-4 h-4 text-success shrink-0" aria-hidden />
              {t("platform.adminsTitle")}
            </Link>
          </Button>
        )}

        <Button
          asChild
          variant="outline"
          className="w-full justify-start min-h-11 rounded-xl font-bold text-xs gap-2.5 hover:bg-warning/10 hover:text-warning hover:border-warning/40 transition-all shadow-2xs cursor-pointer"
        >
          <Link to={ROUTES.platformAccount}>
            <Settings className="w-4 h-4 text-warning shrink-0" aria-hidden />
            {t("platform.myAccount")}
          </Link>
        </Button>
      </div>
    </WidgetCard>
  );
}
