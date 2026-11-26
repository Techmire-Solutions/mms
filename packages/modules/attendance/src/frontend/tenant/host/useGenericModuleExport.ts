import { getAttendanceHost } from "../host.js";

export function useGenericModuleExport(...args: any[]): any {
  return (getAttendanceHost() as any).useGenericModuleExport(...args);
}
