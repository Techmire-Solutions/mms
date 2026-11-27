import { getAccountingHost } from "../host.js";

export function useGenericModuleExport(options: unknown): {
  handleExport: () => void;
  isExporting: boolean;
} {
  return getAccountingHost().useGenericModuleExport(options);
}
