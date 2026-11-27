import { getExaminationsHost } from "../host.js";

export function useGenericModuleExport(...args: any[]): any {
  return (getExaminationsHost() as any).useGenericModuleExport(...args);
}
