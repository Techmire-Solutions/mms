import { getQuestionBankHost } from "../host.js";

export function useModulePermissions(...args: any[]): any {
  return (getQuestionBankHost() as any).useModulePermissions(...args);
}
