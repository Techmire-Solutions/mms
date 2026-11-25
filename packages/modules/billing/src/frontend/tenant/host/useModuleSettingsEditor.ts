import { useFinanceHostValue } from "../host.js";

export function useModuleSettingsEditor<_T = any>(...args: any[]): any {
  return (useFinanceHostValue() as any).useModuleSettingsEditor(...args);
}
