import { getEnrollmentsHost } from "../host.js";

export function usePermissions(...args: any[]): any {
  return (getEnrollmentsHost() as any).usePermissions(...args);
}

export function useModulePermissions(...args: any[]): any {
  return (getEnrollmentsHost() as any).useModulePermissions(...args);
}
