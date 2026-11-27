import { getWorkshopsHost } from "../host.js";

export function useGenericModuleExport(...args: any[]): any {
  return (getWorkshopsHost() as any).useGenericModuleExport(...args);
}
