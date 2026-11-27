import { getObligationsHost } from "../host.js";

function accounts(): any {
  return (getObligationsHost() as any).accountingCollection ?? {};
}

export const ACCOUNTING_ENTRIES_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: (_t: any, k: any) => accounts().ACCOUNTING_ENTRIES_QUERY_KEY?.[k],
}) as unknown as readonly unknown[];

export const ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY: readonly unknown[] = new Proxy([], {
  get: (_t: any, k: any) => accounts().ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY?.[k],
}) as unknown as readonly unknown[];

export function useAccountingContractAccounts(...args: any[]): any {
  return accounts().useAccountingContractAccounts?.(...args);
}
