import { getTasksHost } from "../host.js";

export function useGenericModuleExport(...args: any[]): any {
  return (getTasksHost() as any).useGenericModuleExport(...args);
}
