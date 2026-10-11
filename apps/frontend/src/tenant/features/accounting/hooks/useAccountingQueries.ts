import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchAllAccountingAccounts, fetchAllAccountingEntries } from "./accountingListFetch";
import type {
  AccountingListQuery,
  AccountingReportAggregates,
  AccountingReportQuery,
  Account,
  JournalEntry,
} from "@mms/shared";
import { ACCOUNTING_MODULE_MANIFEST, FINANCE_MODULE_MANIFEST } from "@mms/shared";
import { serverMetricsQueryOptions, useServerMetrics } from "@/hooks/useServerMetrics";
import { useAuth } from "@/lib/contexts/AuthContext";
import { tsrClient } from "@/lib/api";
import { apiJson } from "@/lib/apiClient";
import type { AccountingCommandMetricsSnapshot } from "@mms/shared";

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
export const ACCOUNTING_FISCAL_YEARS_QUERY_KEY = [
  ACCOUNTING_MODULE_MANIFEST.moduleId,
  "fiscal_years",
  "list",
] as const;

export function accountingCommandMetricsQueryOptions() {
  return serverMetricsQueryOptions<AccountingCommandMetricsSnapshot>({
    moduleId: ACCOUNTING_MODULE_MANIFEST.moduleId,
    apiPath: ACCOUNTING_MODULE_MANIFEST.restBasePath,
  });
}

export function useAccountingAccountsPaginated(
  query: AccountingListQuery,
  options?: { enabled?: boolean },
) {
  const { isAuthenticated } = useAuth();
  const enabled = (options?.enabled ?? true) && isAuthenticated;

  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.accounting.listAccounts.useQuery({
    queryKey: [...ACCOUNTING_ACCOUNTS_QUERY_KEY, query],
    queryData: {
      query: {
        page: query.page,
        limit: query.limit,
        search: query.search,
        accountType: query.accountType as never,
        sortField: query.sortField,
        sortDir: query.sortDir,
        includeDeleted: query.includeDeleted ? "true" : undefined,
      },
    },
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useAccountingEntriesPaginated(
  query: AccountingListQuery,
  options?: { enabled?: boolean },
) {
  const { isAuthenticated } = useAuth();
  const enabled = (options?.enabled ?? true) && isAuthenticated;

  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.accounting.listEntries.useQuery({
    queryKey: [...ACCOUNTING_ENTRIES_QUERY_KEY, query],
    queryData: {
      query: {
        page: query.page,
        limit: query.limit,
        search: query.search,
        status: query.status as never,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        accountId: query.accountId,
        sortField: query.sortField,
        sortDir: query.sortDir,
        includeDeleted: query.includeDeleted ? "true" : undefined,
      },
    },
    enabled,
    placeholderData: keepPreviousData,
  });
}

/**
 * Every entry matching `query`, not just the first page.
 *
 * `computeTrialBalance` / `computeFinancials` / `computeLedger` are whole-ledger
 * aggregates, so a single capped page understates them silently.
 */
export function useAllAccountingEntries(
  query: AccountingListQuery,
  options?: { enabled?: boolean },
) {
  const { isAuthenticated } = useAuth();
  const enabled = (options?.enabled ?? true) && isAuthenticated;

  return useQuery({
    queryKey: [
      ...ACCOUNTING_ENTRIES_QUERY_KEY,
      "all",
      {
        search: query.search,
        status: query.status,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        accountId: query.accountId,
        includeDeleted: query.includeDeleted,
      },
    ],
    queryFn: ({ signal }): Promise<JournalEntry[]> => fetchAllAccountingEntries(query, signal),
    enabled,
  });
}

/** Every account (paged through), for the chart of accounts and the account picker. */
export function useAllAccountingAccounts(options?: {
  includeDeleted?: boolean;
  sortField?: string;
  sortDir?: "asc" | "desc";
  enabled?: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const enabled = (options?.enabled ?? true) && isAuthenticated;
  const includeDeleted = options?.includeDeleted ?? false;
  const sortField = options?.sortField ?? "code";
  const sortDir = options?.sortDir ?? "asc";

  return useQuery({
    queryKey: [...ACCOUNTING_ACCOUNTS_QUERY_KEY, "all", { includeDeleted, sortField, sortDir }],
    queryFn: ({ signal }): Promise<Account[]> =>
      fetchAllAccountingAccounts({ includeDeleted, sortField, sortDir }, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useAccountingFiscalYearsPaginated(
  query: AccountingListQuery,
  options?: { enabled?: boolean },
) {
  const { isAuthenticated } = useAuth();
  const enabled = (options?.enabled ?? true) && isAuthenticated;

  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.accounting.listFiscalYears.useQuery({
    queryKey: [...ACCOUNTING_FISCAL_YEARS_QUERY_KEY, query],
    queryData: {
      query: {
        page: query.page,
        limit: query.limit,
        search: query.search,
        sortField: query.sortField,
        sortDir: query.sortDir,
        includeDeleted: query.includeDeleted ? "true" : undefined,
      },
    },
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useAccountingReportAggregates(
  options?: AccountingReportQuery & { enabled?: boolean },
) {
  const { isAuthenticated } = useAuth();
  const enabled = (options?.enabled ?? true) && isAuthenticated;
  const params = new URLSearchParams();
  if (options?.dateFrom) params.set("dateFrom", options.dateFrom);
  if (options?.dateTo) params.set("dateTo", options.dateTo);
  const qs = params.toString();
  const url = `${ACCOUNTING_MODULE_MANIFEST.restBasePath}/report-aggregates${qs ? `?${qs}` : ""}`;

  return useQuery({
    queryKey: [
      ...ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY,
      options?.dateFrom,
      options?.dateTo,
    ] as const,
    queryFn: async ({ signal }): Promise<AccountingReportAggregates> =>
      apiJson<AccountingReportAggregates>(url, { signal }),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAccountingMetrics(options?: { enabled?: boolean }) {
  return useServerMetrics<AccountingCommandMetricsSnapshot>({
    moduleId: ACCOUNTING_MODULE_MANIFEST.moduleId,
    apiPath: ACCOUNTING_MODULE_MANIFEST.restBasePath,
    enabled: options?.enabled,
  });
}

// Re-export FINANCE_MODULE_MANIFEST usage for the specialized mutation
export { FINANCE_MODULE_MANIFEST };
