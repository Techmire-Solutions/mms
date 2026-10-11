import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Lock, Clock, Key, ArrowRight } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/config/routes";
import { PLATFORM_IDLE_SESSION_TIMEOUT_MINUTES } from "@mms/shared";

export function PlatformSecuritySettingsPanel(): React.JSX.Element {
  const { t } = useTranslation();
  const { canSystem } = usePlatformPermissions();

  return (
    <div className="space-y-6 text-start">
      <Card className="rounded-xl border-border/60 shadow-xs">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            {t("platform.securityGovernanceTitle")}
          </CardTitle>
          <CardDescription className="text-xs">
            {t("platform.securityGovernanceDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <div className="text-xs font-medium">{t("platform.idleSessionTitle")}</div>
                <div className="text-3xs text-muted-foreground">
                  {t("platform.idleSessionDesc")}
                </div>
              </div>
            </div>
            <Badge variant="secondary" className="font-mono text-3xs">
              {t("platform.idleSessionMinutes", { minutes: PLATFORM_IDLE_SESSION_TIMEOUT_MINUTES })}
            </Badge>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-center gap-3">
              <Key className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <div className="text-xs font-medium">{t("platform.stepUpEnforcedTitle")}</div>
                <div className="text-3xs text-muted-foreground">
                  {t("platform.stepUpEnforcedDesc")}
                </div>
              </div>
            </div>
            <Badge
              variant="outline"
              className="text-3xs text-success border-success/30 bg-success/5"
            >
              {t("platform.enforced")}
            </Badge>
          </div>

          <div className="pt-2">
            <Button
              asChild
              variant="outline"
              className="min-h-11 rounded-xl text-xs cursor-pointer"
            >
              <Link to={ROUTES.platformAccount}>
                {t("platform.managePersonalSecurity")}
                <ArrowRight className="w-3.5 h-3.5 ms-1.5 rtl:rotate-180" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/60 shadow-xs">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            {t("platform.auditLoggingTitle")}
          </CardTitle>
          <CardDescription className="text-xs">{t("platform.auditLoggingDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {t("platform.auditLoggingBodyBefore")}{" "}
            <code className="text-3xs bg-muted px-1.5 py-0.5 rounded font-mono">
              platform_activity_logs
            </code>{" "}
            {t("platform.auditLoggingBodyAfter")}
          </p>
          {canSystem ? (
            <div className="pt-2">
              <Button
                asChild
                variant="secondary"
                className="min-h-11 rounded-xl text-xs cursor-pointer"
              >
                <Link to={ROUTES.platformActivityLogs}>
                  {t("platform.viewActivityLogs")}
                  <ArrowRight className="w-3.5 h-3.5 ms-1.5 rtl:rotate-180" />
                </Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
