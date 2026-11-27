import { getQuestionBankHost } from "../host.js";

export function useModuleSettingsEditor<_T = any>(...args: any[]): any {
  return (getQuestionBankHost() as any).useModuleSettingsEditor(...args);
}
