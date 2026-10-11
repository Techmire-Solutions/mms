import React from "react";
import { Activity, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { itemVariants } from "@/platform/lib/animations";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/config/routes";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";

/**
 * Compact system-health summary with CTA to System.
 * Full live telemetry lives exclusively on `/platform/system`.
 */
export function PlatformDashboardTelemetry(): React.JSX.Element | null {
  const reducedMotion = useReducedMotion();
  const { t } = useTranslation();
  const { canSystem } = usePlatformPermissions();

  if (!canSystem) return null;

  return (
    <motion.div
      variants={reducedMotion ? undefined : itemVariants}
      initial={reducedMotion ? false : "hidden"}
      animate="show"
      className={cn(
        WORK_SURFACE,
        "flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4",
      )}
      data-testid="dashboard-health-summary"
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Activity className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground text-balance">
            {t("platform.dashboard.systemHealth")}
          </p>
          <p className="text-xs text-muted-foreground text-pretty">
            {t("platform.dashboard.systemHealthHint")}
          </p>
        </div>
      </div>

      <Button asChild className="min-h-11 shrink-0 cursor-pointer">
        <Link to={ROUTES.platformSystem}>
          {t("platform.dashboard.openSystem")}
          <ArrowRight className="ms-1.5 h-4 w-4" aria-hidden />
        </Link>
      </Button>
    </motion.div>
  );
}
