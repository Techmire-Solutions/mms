/**
 * Phase 7: Contract-driven query/mutation hooks for the Accounting module.
 * Uses tsrClient (@ts-rest/react-query v5) for full contract schema enforcement.
 */
import { apiContract, tsrClient } from "@/lib/api";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { invalidateAccountingQueries } from "@/tenant/features/accounting/hooks/invalidateAccountingQueries";
import {
  ACCOUNTING_ACCOUNTS_QUERY_KEY,
  ACCOUNTING_ENTRIES_QUERY_KEY,
  ACCOUNTING_FISCAL_YEARS_QUERY_KEY,
} from "@/tenant/features/accounting/hooks/useAccountingApi";

export function accountingAccountsListQueryOptions(query: Record<string, unknown> = {}) {
  return queryOptions({
    queryKey: [...ACCOUNTING_ACCOUNTS_QUERY_KEY, "contract", query] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.accounting.listAccounts({
        query: query as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        throw new Error("Failed to fetch accounting accounts");
      }
      return response.body;
    },
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export function accountingEntriesListQueryOptions(query: Record<string, unknown> = {}) {
  return queryOptions({
    queryKey: [...ACCOUNTING_ENTRIES_QUERY_KEY, "contract", query] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.accounting.listEntries({
        query: query as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        throw new Error("Failed to fetch accounting entries");
      }
      return response.body;
    },
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export function accountingFiscalYearsListQueryOptions(query: Record<string, unknown> = {}) {
  return queryOptions({
    queryKey: [...ACCOUNTING_FISCAL_YEARS_QUERY_KEY, "contract", query] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.accounting.listFiscalYears({
        query: query as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        throw new Error("Failed to fetch accounting fiscal years");
      }
      return response.body;
    },
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export function useAccountingContractAccounts(query: Record<string, unknown>, enabled = true) {
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.accounting.listAccounts.useQuery({
    queryKey: [...ACCOUNTING_ACCOUNTS_QUERY_KEY, "contract", query],
    queryData: { query },
    staleTime: 15_000,
    enabled,
  });
}

export function useAccountingContractEntries(query: Record<string, unknown>, enabled = true) {
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.accounting.listEntries.useQuery({
    queryKey: [...ACCOUNTING_ENTRIES_QUERY_KEY, "contract", query],
    queryData: { query },
    staleTime: 15_000,
    enabled,
  });
}

export function useAccountingContractFiscalYears(query: Record<string, unknown>, enabled = true) {
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.accounting.listFiscalYears.useQuery({
    queryKey: [...ACCOUNTING_FISCAL_YEARS_QUERY_KEY, "contract", query],
    queryData: { query },
    staleTime: 15_000,
    enabled,
  });
}

export function useAccountingContractUpsertAccounts() {
  const queryClient = useQueryClient();
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.accounting.upsertAccounts.useMutation({
    onSuccess: () => invalidateAccountingQueries(queryClient),
  });
}

export function useAccountingContractUpsertEntries() {
  const queryClient = useQueryClient();
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.accounting.upsertEntries.useMutation({
    onSuccess: () => invalidateAccountingQueries(queryClient),
  });
}

export function useAccountingContractUpsertFiscalYears() {
  const queryClient = useQueryClient();
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.accounting.upsertFiscalYears.useMutation({
    onSuccess: () => invalidateAccountingQueries(queryClient),
  });
}

export function useAccountingContractDeleteEntry() {
  const queryClient = useQueryClient();
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.accounting.deleteEntry.useMutation({
    onSuccess: () => invalidateAccountingQueries(queryClient),
  });
}

export function useAccountingContractRestoreEntry() {
  const queryClient = useQueryClient();
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.accounting.restoreEntry.useMutation({
    onSuccess: () => invalidateAccountingQueries(queryClient),
  });
}

export function useAccountingContractBulkDeleteEntries() {
  const queryClient = useQueryClient();
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.accounting.bulkDeleteEntries.useMutation({
    onSuccess: () => invalidateAccountingQueries(queryClient),
  });
}

export function useAccountingContractBulkRestoreEntries() {
  const queryClient = useQueryClient();
  // @ts-expect-error - TS union discrimination limit with ts-rest
  return tsrClient.accounting.bulkRestoreEntries.useMutation({
    onSuccess: () => invalidateAccountingQueries(queryClient),
  });
}
