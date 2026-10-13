import type { AccessControlledModuleId, ModuleAccessDecision, ModuleAction } from "@mms/shared";
import { isNavPathActive } from "@/lib/config/routes";
import { TENANT_APP_ROUTE_ACCESS, type TenantRouteAccess } from "@/lib/routing/moduleRegistry";

/**
 * Access classification for every route rendered inside the tenant app shell
 * (derived from `@/lib/config/moduleRegistry`).
 * - `module`: owned by a module; gated on grant, enablement, and `action`.
 * - `landing`: Home — always reachable; its widgets and requests gate per module.
 * - `open`: not module-owned; any signed-in user (finer gating inside the page).
 */
export type RouteAccessRule = TenantRouteAccess;

/** Route → module metadata; nested paths inherit their parent entry. */
export { TENANT_APP_ROUTE_ACCESS };

/** Most specific rule for a pathname; Home only matches exactly. */
export function findRouteAccessRule(pathname: string): RouteAccessRule | undefined {
  const match = Object.keys(TENANT_APP_ROUTE_ACCESS)
    .filter((path) => isNavPathActive(pathname, path))
    .sort((a, b) => b.length - a.length)[0];
  return match ? TENANT_APP_ROUTE_ACCESS[match] : undefined;
}

export type ModuleAccessEvaluator = (
  moduleId: string,
  action?: ModuleAction,
) => ModuleAccessDecision;

/**
 * Whether the page at `pathname` may render. Unknown app-shell paths fail
 * closed; Home and `open` routes always render.
 */
export function resolveRouteAccess(
  pathname: string,
  evaluate: ModuleAccessEvaluator,
): ModuleAccessDecision & { moduleId?: AccessControlledModuleId } {
  const rule = findRouteAccessRule(pathname);
  if (!rule) return { allowed: false, code: "MODULE_NOT_GRANTED" };
  if (rule.kind !== "module") return { allowed: true };
  return { ...evaluate(rule.moduleId, rule.action), moduleId: rule.moduleId };
}

/** Navigation visibility for a path: Home shows only when its module is readable. */
export function canShowRoute(path: string, evaluate: ModuleAccessEvaluator): boolean {
  const rule = findRouteAccessRule(path);
  if (!rule) return false;
  if (rule.kind === "open") return true;
  return evaluate(rule.moduleId, rule.kind === "module" ? rule.action : "read").allowed;
}
