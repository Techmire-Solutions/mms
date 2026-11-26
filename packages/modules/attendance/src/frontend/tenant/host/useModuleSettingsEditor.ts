import { getAttendanceHost } from "../host.js";

export function useModuleSettingsEditor<_T = any>(...args: any[]): any {
  return (getAttendanceHost() as any).useModuleSettingsEditor(...args);
}
