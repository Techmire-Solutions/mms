import { getObligationsHost } from "../host.js";

export function useFinanceCurrency(...args: any[]): any {
  return (getObligationsHost() as any).useFinanceCurrency(...args);
}
