import { useHasanatHost } from "../host.js";

export interface GenericModuleExport {
  handleExport: (...args: unknown[]) => Promise<void> | void;
  isExporting: boolean;
}

export function useGenericModuleExport(...args: any[]): GenericModuleExport {
  return useHasanatHost().useGenericModuleExport(...args) as GenericModuleExport;
}
