import React from "react";
import { ShieldCheck, ShieldAlert, CheckCircle2, Award } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { WidgetCard } from "@/components/app/WidgetCard";
import { WidgetCardHeader } from "@/components/app/WidgetCardHeader";
import { Badge } from "@shared/ui";
import { WORK_SURFACE_INNER } from "@shared/ui";
import { cn } from "@/lib/utils";
import type { PlatformUser } from "@mms/shared";

interface PlatformReportsOperatorCardProps {
  platformUser?: PlatformUser | null;
  isSuperUser: boolean;
  canWorkspaces: boolean;
  canOnboard: boolean;
  canSettings: boolean;
  canAdmins: boolean;
  canSystem: boolean;
}

export function PlatformReportsOperatorCard({
  platformUser,
  isSuperUser,
  canWorkspaces,
  canOnboard,
  canSettings,
  canAdmins,
  canSystem,
}: PlatformReportsOperatorCardProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <WidgetCard className="p-6 space-y-4">
      <WidgetCardHeader
        icon={<ShieldCheck className="w-4 h-4 text-success" />}
        title={t("platform.operatorIdentityTitle")}
        subtitle={t("platform.operatorIdentitySub")}
      />

      <div className={cn(WORK_SURFACE_INNER, "p-5 space-y-4")}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-base font-black tracking-tight text-foreground truncate">
              {platformUser?.name}
            </h4>
            <p className="text-xs font-mono text-muted-foreground truncate">
              {platformUser?.email}
            </p>
          </div>
        </div>

        <div className="space-y-2.5 pt-3 border-t border-border/40 text-xs font-semibold">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("platform.roleLevel")}</span>
            <span className="font-black text-primary flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-primary" />
              {platformUser?.role === "super_user"
                ? t("platform.roleSuperUser")
                : t("platform.roleAdmin")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("platform.sessionStatus")}</span>
            <span className="font-bold text-success flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t("platform.sessionAuthenticated")}
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-border/40 space-y-2">
          <span className="text-3xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-primary" />
            {t("platform.capabilitiesLabel")}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {canWorkspaces && (
              <Badge as="span" tone="primary" size="sm" pill>
                {t("platform.manageMadrasas")}
              </Badge>
            )}
            {canOnboard && (
              <Badge as="span" tone="success" size="sm" pill>
                {t("platform.onboardCapability")}
              </Badge>
            )}
            {canSettings && (
              <Badge as="span" tone="info" size="sm" pill>
                {t("platform.permSettings")}
              </Badge>
            )}
            {canAdmins && (
              <Badge as="span" tone="primary" size="sm" pill>
                {t("platform.permAdmins")}
              </Badge>
            )}
            {canSystem && (
              <Badge as="span" tone="warning" size="sm" pill>
                {t("platform.permSystem")}
              </Badge>
            )}
            {isSuperUser && (
              <Badge as="span" tone="warning" size="sm" pill>
                {t("platform.roleSuperUser")}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </WidgetCard>
  );
}
