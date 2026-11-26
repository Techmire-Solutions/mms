import { getAttendanceHost } from "../host.js";

export function useWorkDrillDownListener<_T = any>(...args: any[]): any {
  return (getAttendanceHost() as any).useWorkDrillDownListener(...args);
}
