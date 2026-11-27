import { getExaminationsHost } from "../host.js";

export function useModuleSettingsEditor<_T = any>(...args: any[]): any {
  return (getExaminationsHost() as any).useModuleSettingsEditor(...args);
}
