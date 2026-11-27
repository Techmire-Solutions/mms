import { getQuestionBankHost } from "../host.js";

export function sessionIdForClass(...args: any[]): any {
  return (getQuestionBankHost() as any).sessionIdForClass(...args);
}
