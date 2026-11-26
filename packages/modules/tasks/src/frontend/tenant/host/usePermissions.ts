import { getTasksHost } from "../host.js";

export function usePermissions(...args: any[]): any {
  return (getTasksHost() as any).usePermissions(...args);
}

export function useModulePermissions(...args: any[]): any {
  return (getTasksHost() as any).useModulePermissions(...args);
}
