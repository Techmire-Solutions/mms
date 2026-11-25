import { useFinanceHostValue } from "../host.js";

export function useWorkDrillDownListener<_T = any>(...args: any[]): void {
  (useFinanceHostValue() as any).useWorkDrillDownListener(...args);
}
