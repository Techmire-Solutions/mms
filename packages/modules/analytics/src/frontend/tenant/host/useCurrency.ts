import { getAnalyticsHost } from "../host.js";

export function useCurrency(...args: any[]): any {
  return (getAnalyticsHost() as any).useCurrency(...args);
}

export function useFinanceCurrency(...args: any[]): any {
  return (getAnalyticsHost() as any).useFinanceCurrency(...args);
}
