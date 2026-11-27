import { getAccountingHost, type AccountingConfig } from "../host.js";

export function useAccountingConfig(): AccountingConfig {
  return getAccountingHost().useAccountingConfig();
}
