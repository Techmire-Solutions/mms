import React from "react";
import { WidgetCard } from "@/components/app/WidgetCard";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { ROUTES } from "@/lib/config/routes";
import { getQuickActionsForRole } from "@/lib/dashboardQuickActions";
import { getQuickActionGlowClass, getQuickActionIconClasses } from "@/lib/ui/dashboardWidgetColors";
import type { DashboardRole } from "@/lib/dashboardRole";
import { useModuleAccess } from "@/tenant/hooks/useModuleAccess";
import { useTranslation } from "@/hooks/useTranslation";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface QuickActionsPanelProps {
  dashboardRole: DashboardRole;
}

/**
 * Role-specific quick actions filtered by enabled modules and write permissions.
 */
export function QuickActionsPanel({
  dashboardRole,
}: QuickActionsPanelProps): React.JSX.Element | null {
  const { evaluate } = useModuleAccess();
  const { t } = useTranslation();
  const { can } = usePermissions();
  const reducedMotion = useReducedMotion();

  const actions = (() =>
    getQuickActionsForRole(dashboardRole).filter(
      (quickAction) =>
        evaluate(quickAction.moduleId, "availability").allowed && can(quickAction.permission),
    ))();

  if (actions.length === 0) return null;

  return (
    <WidgetCard
      ariaLabelledby="quick-actions-panel-heading"
      accentColor="primary"
      className="p-5 px-6 pb-6"
    >
      <div className="flex items-center gap-2.5 pb-1.5 border-b border-border/40 mb-4.5 select-none">
        <Sparkles className="w-4 h-4 text-primary/70 group-hover:text-primary transition-colors" />
        <h3 id="quick-actions-panel-heading" className="text-sm font-bold text-foreground m-0">
          {t("action.quickActions")}
        </h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {actions.map((quickAction, actionIndex) => {
          const Icon = quickAction.icon;
          const label = t(quickAction.labelKey);
          const href = quickAction.route || ROUTES.home;
          return (
            <motion.div
              key={quickAction.id}
              initial={false}
              animate={{ opacity: 1, scale: 1 }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { delay: actionIndex * 0.05, duration: 0.3, ease: "easeOut" }
              }
            >
              <Link
                to={href}
                aria-label={label}
                className="relative overflow-hidden group/item flex flex-col items-start gap-2.5 p-3.5 rounded-xl border border-border/70 bg-card/20 hover:bg-card/45 hover:-translate-y-1 hover:border-primary/20 hover:shadow-md transition-all duration-300 text-start h-full w-full shadow-xs"
              >
                <div
                  className={`absolute -end-8 -top-8 w-20 h-20 rounded-full transition-all duration-500 blur-xl opacity-40 group-hover/item:opacity-70 ${getQuickActionGlowClass(quickAction.color)}`}
                  aria-hidden="true"
                />

                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover/item:scale-110 duration-300 ${getQuickActionIconClasses(quickAction.color)}`}
                  aria-hidden="true"
                >
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground group-hover/item:text-primary transition-colors m-0 leading-tight">
                    {label}
                  </p>
                  <p className="text-xs font-medium text-foreground mt-1 m-0 leading-normal">
                    {t(quickAction.descKey)}
                  </p>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </WidgetCard>
  );
}

export default QuickActionsPanel;
