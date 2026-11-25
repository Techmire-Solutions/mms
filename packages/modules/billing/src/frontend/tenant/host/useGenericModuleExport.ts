import { useFinanceHostValue } from "../host.js";

export function useGenericModuleExport(...args: any[]) {
  return (useFinanceHostValue() as any).useGenericModuleExport(...args);
}
