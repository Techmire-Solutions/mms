import { useFinanceHostValue } from "../host.js";

export function useCurrency(...args: any[]) {
  return (useFinanceHostValue() as any).useCurrency(...args);
}

export function useFinanceCurrency(...args: any[]) {
  return (useFinanceHostValue() as any).useFinanceCurrency(...args);
}
