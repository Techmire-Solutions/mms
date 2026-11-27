import { getAnalyticsHost } from "../host.js";

export function usePermissions(...args: any[]): any {
  return (getAnalyticsHost() as any).usePermissions(...args);
}

export function useModulePermissions(...args: any[]): any {
  return (getAnalyticsHost() as any).useModulePermissions(...args);
}
