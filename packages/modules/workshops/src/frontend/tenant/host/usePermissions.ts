import { getWorkshopsHost } from "../host.js";

export function usePermissions(...args: any[]): any {
  return (getWorkshopsHost() as any).usePermissions(...args);
}

export function useModulePermissions(...args: any[]): any {
  return (getWorkshopsHost() as any).useModulePermissions(...args);
}
