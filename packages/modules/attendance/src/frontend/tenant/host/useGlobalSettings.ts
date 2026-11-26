import { getAttendanceHost } from "../host.js";

export function useGlobalSettings(...args: any[]): any {
  return (getAttendanceHost() as any).useGlobalSettings(...args);
}
