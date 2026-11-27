import { getQuestionBankHost } from "../host.js";

export function useSessionsCollection(...args: any[]): any {
  return (getQuestionBankHost() as any).useSessionsCollection(...args);
}
