import { useFinanceHostValue } from "../host.js";

export function useFinanceConfig(...args: any[]) {
  return (useFinanceHostValue() as any).useFinanceConfig(...args);
}
