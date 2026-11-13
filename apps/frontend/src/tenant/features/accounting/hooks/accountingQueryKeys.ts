import { ACCOUNTING_MODULE_MANIFEST } from "@mms/shared";

export const ACCOUNTING_METRICS_QUERY_KEY = [
  ACCOUNTING_MODULE_MANIFEST.moduleId,
  "metrics",
] as const;
export const ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY = [
  ACCOUNTING_MODULE_MANIFEST.moduleId,
  "report-aggregates",
] as const;
export const ACCOUNTING_ACCOUNTS_QUERY_KEY = [
  ACCOUNTING_MODULE_MANIFEST.moduleId,
  "accounts",
  "list",
] as const;
export const ACCOUNTING_ENTRIES_QUERY_KEY = [
  ACCOUNTING_MODULE_MANIFEST.moduleId,
  "entries",
  "list",
] as const;
/**
 * Exact prefix of the paginated register cache. `accountingListFetch` builds its
 * page key from this tuple; a hand-copied literal there would silently escape the
 * post-write invalidation if the two ever diverged.
 */
export const ACCOUNTING_ENTRIES_LIST_PREFIX = ACCOUNTING_ENTRIES_QUERY_KEY;
export const ACCOUNTING_FISCAL_YEARS_QUERY_KEY = [
  ACCOUNTING_MODULE_MANIFEST.moduleId,
  "fiscal_years",
  "list",
] as const;
