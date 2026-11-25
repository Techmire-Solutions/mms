import { getStudentsHost } from "../host.js";

export function useFinanceCurrency(...args: any[]): any {
  return (getStudentsHost() as any).useFinanceCurrency(...args);
}
