import { getExaminationsHost } from "../host.js";

export function useModulePermissions(...args: any[]): any {
  return (getExaminationsHost() as any).useModulePermissions(...args);
}

export function usePermissions(...args: any[]): any {
  return (getExaminationsHost() as any).useModulePermissions(...args);
}
