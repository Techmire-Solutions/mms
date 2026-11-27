import { getIamHost } from "../host.js";

export function usePermissions(...args: any[]): any {
  return (getIamHost() as any).usePermissions(...args);
}

export function useModulePermissions(...args: any[]): any {
  return (getIamHost() as any).useModulePermissions(...args);
}
