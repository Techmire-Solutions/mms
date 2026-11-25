import { getSessionsHost } from "../host.js";

export function usePermissions(...args: any[]): any {
  return (getSessionsHost() as any).usePermissions(...args);
}

export function useModulePermissions(...args: any[]): any {
  return (getSessionsHost() as any).useModulePermissions(...args);
}
