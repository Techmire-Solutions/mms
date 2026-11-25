import { getEnrollmentsHost } from "../host.js";

export function useModuleSettingsEditor<_T = any>(...args: any[]): any {
  return (getEnrollmentsHost() as any).useModuleSettingsEditor(...args);
}
