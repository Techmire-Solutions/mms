import { useFinanceHostValue } from "../host.js";

export function useDocumentCurrency(...args: any[]) {
  return (useFinanceHostValue() as any).useDocumentCurrency(...args);
}
