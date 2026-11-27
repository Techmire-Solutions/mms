import { getQuestionBankHost } from "../host.js";

export function useGenericModuleExport(...args: any[]): any {
  return (getQuestionBankHost() as any).useGenericModuleExport(...args);
}
