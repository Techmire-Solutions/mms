import { getStudentsHost } from "../host.js";

export function useModuleSettingsEditor<_T = any>(...args: any[]): any {
  return (getStudentsHost() as any).useModuleSettingsEditor(...args);
}
