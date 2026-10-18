import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { findRouteAccessRule, resolveRouteAccess } from "@/lib/config/routeAccess";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { useModuleAccess } from "@/tenant/hooks/useModuleAccess";
import { ModuleAccessDeniedState } from "./ModuleAccessDeniedState";

/**
 * Gates every app-shell route on `TENANT_APP_ROUTE_ACCESS`. Module pages render
 * (and start their requests) only once the server's module availability is
 * loaded and the policy allows them; loading and fetch failures never grant
 * access, and a later access change unmounts the page. The backend
 * `registerModuleAccess` guard remains the authority for data.
 */
export default function ModuleAccessRoute(): React.JSX.Element {
  const { pathname } = useLocation();
  const access = useModuleAccess();
  const rule = findRouteAccessRule(pathname);

  if (rule && rule.kind !== "module") return <Outlet />;
  if (access.status === "pending") return <RouteStatusFallback />;
  if (access.status === "error") {
    return <ModuleAccessDeniedState code="MODULE_ACCESS_UNAVAILABLE" onRetry={access.retry} />;
  }

  const decision = resolveRouteAccess(pathname, access.evaluate);
  if (decision.allowed) return <Outlet />;

  const showModuleSettingsLink =
    decision.code === "MODULE_DISABLED" &&
    access.canManageModules &&
    decision.moduleId !== undefined &&
    access.availability?.[decision.moduleId]?.granted === true;

  return (
    <ModuleAccessDeniedState code={decision.code} showModuleSettingsLink={showModuleSettingsLink} />
  );
}
