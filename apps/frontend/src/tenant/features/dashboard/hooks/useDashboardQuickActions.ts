import { useMemo } from "react";
import { getQuickActionsForRole, type DashboardQuickAction } from "@/lib/dashboardQuickActions";
import type { DashboardRole } from "@/lib/dashboardRole";
import { useModuleAccess } from "@/tenant/hooks/useModuleAccess";
import { usePermissions } from "@/tenant/hooks/usePermissions";

/**
 * Role-scoped quick actions filtered by server-authoritative module availability
 * and the caller's write permission.
 *
 * Extracted from the panel so the dashboard can lay out its footer row from the
 * same list — an empty list used to leave two thirds of the row blank.
 */
export function useDashboardQuickActions(dashboardRole: DashboardRole): DashboardQuickAction[] {
  const { evaluate } = useModuleAccess();
  const { can } = usePermissions();

  return useMemo(
    () =>
      getQuickActionsForRole(dashboardRole).filter(
        (quickAction) =>
          evaluate(quickAction.moduleId, "availability").allowed && can(quickAction.permission),
      ),
    [dashboardRole, evaluate, can],
  );
}
