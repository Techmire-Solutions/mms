interface FinanceAccountingKeys {
  ACCOUNTING_ENTRIES_QUERY_KEY?: unknown;
  ACCOUNTING_METRICS_QUERY_KEY?: unknown;
  ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY?: unknown;
  invalidateAccountingQueries?: (...args: any[]) => void;
}

let keys: FinanceAccountingKeys = {};
export function configureFinanceAccountingKeys(next: FinanceAccountingKeys): void {
  keys = next;
}

export const ACCOUNTING_ENTRIES_QUERY_KEY: any = () => keys.ACCOUNTING_ENTRIES_QUERY_KEY;
export const ACCOUNTING_METRICS_QUERY_KEY: any = () => keys.ACCOUNTING_METRICS_QUERY_KEY;
export const ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY: any = () =>
  keys.ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY;
export function invalidateAccountingQueries(...args: any[]): void {
  keys.invalidateAccountingQueries?.(...args);
}
