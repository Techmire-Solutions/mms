import { getStudentsHost } from "../host.js";

export function usePermissions(...args: any[]): any {
  return (getStudentsHost() as any).usePermissions(...args);
}

export function useModulePermissions(...args: any[]): any {
  return (getStudentsHost() as any).useModulePermissions(...args);
}
