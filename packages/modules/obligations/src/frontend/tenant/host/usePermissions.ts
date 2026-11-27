import { getObligationsHost } from "../host.js";

export function usePermissions(...args: any[]): any {
  return (getObligationsHost() as any).usePermissions(...args);
}

export function useModulePermissions(...args: any[]): any {
  return (getObligationsHost() as any).useModulePermissions(...args);
}
