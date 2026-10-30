import React from "react";
import { Link } from "react-router-dom";
import { Radio, Globe } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Button } from "@shared/ui";
import { WORK_SURFACE } from "@shared/ui";
import { Badge } from "@shared/ui";
import { itemVariants } from "@/platform/lib/animations";
import { ROUTES } from "@/lib/config/routes";
import { cn } from "@/lib/utils";
import type { PlatformUser } from "@mms/shared";

export interface PlatformDashboardBannerProps {
  platformUser?: PlatformUser | null;
  isSuperUser: boolean;
  canWorkspaces: boolean;
}

/** Greeting + primary CTAs only — fleet counts live in the metrics grid. */
export function PlatformDashboardBanner({
  platformUser,
  isSuperUser,
  canWorkspaces,
}: PlatformDashboardBannerProps): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      variants={reducedMotion ? undefined : itemVariants}
      className={cn(WORK_SURFACE, "p-6 sm:p-8 relative overflow-hidden")}
    >
      <div className="relative z-elevated space-y-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge
            tone="primary"
            pill
            size="md"
            className="font-bold uppercase tracking-wider shadow-2xs"
          >
            {t("platform.consoleTitle")}
          </Badge>
          <Badge tone="success" pill size="md" dot pulse className="font-semibold shadow-2xs">
            {t("platform.statusOperational")}
          </Badge>
          <span className="text-xs font-mono text-muted-foreground ms-auto hidden sm:inline-flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-lg border border-border/60">
            <Radio className="w-3 h-3 text-success" /> {t("platform.banner.realtimePulse")}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-black text-foreground tracking-tight text-balance">
              {t("platform.welcomeBack", {
                name: platformUser?.name ?? t("platform.operatorRole"),
              })}
            </h1>
            <p className="text-sm font-medium text-muted-foreground max-w-xl leading-relaxed mt-1 text-pretty">
              {isSuperUser ? t("platform.superConsoleDesc") : t("platform.operatorConsoleDesc")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {canWorkspaces && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="rounded-xl font-bold gap-1.5 hover:bg-muted transition-all min-h-11 px-4 cursor-pointer"
              >
                <Link to={ROUTES.platformWorkspaces}>
                  <Globe className="w-4 h-4 text-primary" aria-hidden />
                  {t("platform.manageMadrasas")}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
