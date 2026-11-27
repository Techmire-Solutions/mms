import { getIamHost } from "../host.js";

export function useModuleSettingsEditor<_T = any>(...args: any[]): any {
  return (getIamHost() as any).useModuleSettingsEditor(...args);
}
