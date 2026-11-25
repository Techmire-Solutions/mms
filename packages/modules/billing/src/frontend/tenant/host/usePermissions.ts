import { useFinanceHostValue } from "../host.js";

export function usePermissions(...args: any[]) {
  return (useFinanceHostValue() as any).usePermissions(...args);
}

export function useModulePermissions(...args: any[]) {
  return (useFinanceHostValue() as any).useModulePermissions(...args);
}
