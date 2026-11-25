import { getSessionsHost } from "../host.js";

export function useModuleSettingsEditor<_T = unknown>(...args: any[]): any {
  return (getSessionsHost() as any).useModuleSettingsEditor(...args);
}
