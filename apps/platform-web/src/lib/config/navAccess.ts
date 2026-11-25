import type { NavItem } from "@/lib/config/navConfig";
import { canShowRoute, type ModuleAccessEvaluator } from "@/lib/config/routeAccess";

/**
 * Sidebar items the viewer may open, using the same route registry and policy
 * as the route guard; groups with no visible children are dropped.
 */
export function filterSidebarNavItems(
  items: readonly NavItem[],
  evaluate: ModuleAccessEvaluator,
): NavItem[] {
  return items
    .map((item) =>
      item.subItems
        ? { ...item, subItems: item.subItems.filter((sub) => canShowRoute(sub.path, evaluate)) }
        : item,
    )
    .filter((item) =>
      item.subItems
        ? item.subItems.length > 0
        : item.path !== undefined && canShowRoute(item.path, evaluate),
    );
}
