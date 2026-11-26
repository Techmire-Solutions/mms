import { getAttendanceHost } from "../host.js";

export function usePermissions(...args: any[]): any {
  return (getAttendanceHost() as any).usePermissions(...args);
}

export function useModulePermissions(...args: any[]): any {
  return (getAttendanceHost() as any).useModulePermissions(...args);
}
