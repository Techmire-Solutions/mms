import { getObligationsHost } from "../host.js";

export function useGenericModuleExport(...args: any[]): any {
  return (getObligationsHost() as any).useGenericModuleExport(...args);
}
