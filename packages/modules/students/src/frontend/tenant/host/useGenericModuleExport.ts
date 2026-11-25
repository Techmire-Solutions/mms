import { getStudentsHost } from "../host.js";

export function useGenericModuleExport(...args: any[]): any {
  return (getStudentsHost() as any).useGenericModuleExport(...args);
}
