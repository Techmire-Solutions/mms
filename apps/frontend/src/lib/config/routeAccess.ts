import type { AccessControlledModuleId, ModuleAccessDecision, ModuleAction } from "@mms/shared";
import { ROUTES, isNavPathActive } from "@/lib/config/routes";

/**
 * Access classification for every route rendered inside the tenant app shell.
 * - `module`: owned by a module; gated on grant, enablement, and `action`.
 * - `landing`: Home — always reachable; its widgets and requests gate per module.
 * - `open`: not module-owned; any signed-in user (finer gating inside the page).
 */
export type RouteAccessRule =
  | { kind: "module"; moduleId: AccessControlledModuleId; action: ModuleAction }
  | { kind: "landing"; moduleId: AccessControlledModuleId }
  | { kind: "open"; reason: string };

const moduleRoute = (moduleId: AccessControlledModuleId): RouteAccessRule => ({
  kind: "module",
  moduleId,
  action: "read",
});

/** Single source for route → module metadata; nested paths inherit their parent entry. */
export const TENANT_APP_ROUTE_ACCESS: Readonly<Record<string, RouteAccessRule>> = {
  [ROUTES.home]: { kind: "landing", moduleId: "dashboard" },
  [ROUTES.contacts]: moduleRoute("contacts"),
  [ROUTES.messaging]: moduleRoute("messaging"),
  [ROUTES.students]: moduleRoute("students"),
  [ROUTES.faculty]: moduleRoute("faculty"),
  [ROUTES.enrollments]: moduleRoute("enrollment"),
  [ROUTES.sessions]: moduleRoute("sessions"),
  [ROUTES.attendance]: moduleRoute("attendance"),
  [ROUTES.finance]: moduleRoute("finance"),
  [ROUTES.hasanatCards]: moduleRoute("hasanat"),
  [ROUTES.examinations]: moduleRoute("examination"),
  [ROUTES.questionBank]: moduleRoute("questionBank"),
  [ROUTES.accounting]: moduleRoute("accounting"),
  [ROUTES.obligations]: moduleRoute("obligations"),
  [ROUTES.tasks]: moduleRoute("tasks"),
  [ROUTES.users]: moduleRoute("users"),
  [ROUTES.profile]: { kind: "open", reason: "the signed-in user's own account" },
  [ROUTES.notifications]: {
    kind: "open",
    reason: "the signed-in user's own alerts; each alert gates its module permission",
  },
  [ROUTES.settings]: {
    kind: "open",
    reason: "workspace settings; each section gates its own permission",
  },
};

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
