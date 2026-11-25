import { getEnrollmentsHost } from "../host.js";

export function useCurrency(...args: any[]): any {
  return (getEnrollmentsHost() as any).useCurrency(...args);
}

export function useFinanceCurrency(...args: any[]): any {
  return (getEnrollmentsHost() as any).useFinanceCurrency(...args);
}
