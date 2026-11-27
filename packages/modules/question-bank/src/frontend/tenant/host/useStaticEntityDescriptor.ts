import { getQuestionBankHost } from "../host.js";

export function useStaticEntityDescriptor(...args: any[]): any {
  return (getQuestionBankHost() as any).useStaticEntityDescriptor(...args);
}
