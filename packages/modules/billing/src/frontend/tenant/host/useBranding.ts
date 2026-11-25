import { useFinanceHostValue } from "../host.js";

export function useBranding(...args: any[]) {
  return (useFinanceHostValue() as any).useBranding(...args);
}
