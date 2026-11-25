import { getSessionsHost } from "../host.js";

export function useCurrency(...args: any[]): any {
  return (getSessionsHost() as any).useCurrency(...args);
}

export function useFinanceCurrency(...args: any[]): any {
  return (getSessionsHost() as any).useFinanceCurrency?.(...args);
}
