import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchAllAccountingAccounts } from "./accountingListFetch";
import type {
  AccountingLedgerPage,
  AccountingListQuery,
  AccountingReportAggregates,
  AccountingReportQuery,
  Account,
  JournalEntry,
  ReceivablesAging,
} from "@mms/shared";
import { ACCOUNTING_MODULE_MANIFEST, FINANCE_MODULE_MANIFEST } from "@mms/shared";
import { serverMetricsQueryOptions, useServerMetrics } from "@/hooks/useServerMetrics";
import { useAuth } from "@/lib/contexts/AuthContext";
import { apiContract, tsrClient } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { assertContractOk } from "@/lib/apiContractError";
import type { AccountingCommandMetricsSnapshot } from "@mms/shared";
import {
  ACCOUNTING_METRICS_QUERY_KEY,
  ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY,
  ACCOUNTING_ACCOUNTS_QUERY_KEY,
  ACCOUNTING_ENTRIES_QUERY_KEY,
  ACCOUNTING_FISCAL_YEARS_QUERY_KEY,
} from "./accountingQueryKeys";

export {
  ACCOUNTING_METRICS_QUERY_KEY,
  ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY,
  ACCOUNTING_ACCOUNTS_QUERY_KEY,
  ACCOUNTING_ENTRIES_QUERY_KEY,
  ACCOUNTING_FISCAL_YEARS_QUERY_KEY,
};

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
  return useQuery({
    queryKey: [
      ...ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY,
      options?.dateFrom,
      options?.dateTo,
    ] as const,
    queryFn: async ({ signal }): Promise<AccountingReportAggregates> => {
      const response = await apiContract.accounting.getReportAggregates({
        query: {
          ...(options?.dateFrom ? { dateFrom: options.dateFrom } : {}),
          ...(options?.dateTo ? { dateTo: options.dateTo } : {}),
        },
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        const errorBody = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          errorBody?.message ?? "Failed to fetch accounting report aggregates",
          errorBody?.type,
        );
      }
      return response.body as AccountingReportAggregates;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Query keys shared by the server-computed ledger report. */
export const ACCOUNTING_LEDGER_QUERY_KEY = [...ACCOUNTING_ENTRIES_QUERY_KEY, "ledger"] as const;
export const ACCOUNTING_AGING_QUERY_KEY = [...ACCOUNTING_ENTRIES_QUERY_KEY, "aging"] as const;

/**
 * Server-computed General Ledger page. The browser aggregate truncated at 5,000
 * entries, so a large ledger showed a wrong running/closing balance; the server
 * computes the opening balance and running balance exactly.
 */
export function useAccountingLedger(
  query: { accountId: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number },
  options?: { enabled?: boolean },
) {
  const { isAuthenticated } = useAuth();
  const enabled = (options?.enabled ?? true) && isAuthenticated && Boolean(query.accountId);
  return useQuery({
    queryKey: [
      ...ACCOUNTING_LEDGER_QUERY_KEY,
      query.accountId,
      query.dateFrom,
      query.dateTo,
      query.page ?? 1,
      query.limit ?? 100,
    ] as const,
    queryFn: async ({ signal }): Promise<AccountingLedgerPage> => {
      const response = await apiContract.accounting.getLedger({
        query: {
          accountId: query.accountId,
          ...(query.dateFrom ? { dateFrom: query.dateFrom } : {}),
          ...(query.dateTo ? { dateTo: query.dateTo } : {}),
          page: query.page ?? 1,
          limit: query.limit ?? 100,
        },
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        const errorBody = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          errorBody?.message ?? "Failed to fetch the account ledger",
          errorBody?.type,
        );
      }
      return response.body as AccountingLedgerPage;
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/**
 * One journal entry with its lines.
 *
 * The drawer fetches the selected entry by id rather than relying on the row
 * payload; the register ships full vouchers because Cashbook/print/the wizard need
 * the lines, but the detail path stays the source for a freshly edited voucher.
 */
export function useJournalEntryDetail(entryId: string | null, options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const enabled = (options?.enabled ?? true) && isAuthenticated && Boolean(entryId);
  return useQuery({
    queryKey: [...ACCOUNTING_ENTRIES_QUERY_KEY, "detail", entryId] as const,
    queryFn: async ({ signal }): Promise<JournalEntry> => {
      const response = await apiContract.accounting.getEntry({
        params: { id: entryId as string },
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to load the journal entry");
      return response.body as JournalEntry;
    },
    enabled,
    staleTime: 15_000,
  });
}

/** Student receivables aging as of a date (server buckets, exact totals). */
export function useReceivablesAging(asOf: string, page = 1, options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const enabled = (options?.enabled ?? true) && isAuthenticated && Boolean(asOf);
  return useQuery({
    queryKey: [...ACCOUNTING_AGING_QUERY_KEY, asOf, page] as const,
    queryFn: async ({ signal }): Promise<ReceivablesAging> => {
      const response = await apiContract.accounting.getReceivablesAging({
        query: { asOf, page },
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        const errorBody = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          errorBody?.message ?? "Failed to fetch receivables aging",
          errorBody?.type,
        );
      }
      return response.body as ReceivablesAging;
    },
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
