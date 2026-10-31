/**
 * Contacts module server-state surface.
 * Aggregates the module's Query hooks, keys, and mutations for external
 * consumers; contract-driven (tsrClient) list/detail/mutation hooks own the
 * Phase 7 surface here.
 */
import { apiContract, tsrClient } from "@/lib/api";
import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { ContactsListPageResult } from "@mms/shared";
import {
  CONTACTS_FIELD_CONFIG_QUERY_KEY,
  CONTACTS_QUERY_KEY,
  CONTACTS_REPORT_ANALYTICS_QUERY_KEY,
} from "@/tenant/features/contacts/hooks/contactsQueryKeys";
import { invalidateContactsQueries } from "@/tenant/features/contacts/hooks/invalidateContactsQueries";

export {
  CONTACTS_QUERY_KEY,
  CONTACTS_METRICS_QUERY_KEY,
  CONTACTS_WIDGET_AGGREGATES_QUERY_KEY,
  CONTACTS_DUPLICATES_QUERY_KEY,
  contactDetailQueryKey,
} from "@/tenant/features/contacts/hooks/contactsQueryKeys";

export {
  fetchContactById,
  useContactById,
  useContactsByIds,
} from "@/tenant/features/contacts/hooks/useContactsListQueries";

export {
  contactsCommandMetricsQueryOptions,
  useContactsMetrics,
  useContactsReportAnalytics,
  useContactsWidgetAggregates,
  useContactsDuplicatePairs,
} from "@/tenant/features/contacts/hooks/useContactsAnalyticsQueries";

export {
  useContactGoogleSyncConfig,
  useContactGoogleSyncMutations,
} from "@/tenant/features/contacts/hooks/useContactGoogleSyncQueries";

export {
  useContactColumnPrefs,
  useContactColumnPrefsMutation,
  useContactsSavedReportsSource,
} from "@/tenant/features/contacts/hooks/useContactPrefsQueries";
import { assertContractOk } from "@/lib/apiContractError";

// --- Phase 7: contract-driven tsrClient hooks & query factories -------------

export function contactsListQueryOptions(query: Record<string, unknown> = {}) {
  return queryOptions({
    queryKey: [...CONTACTS_QUERY_KEY, "contract-list", query] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.contacts.list({
        query: query as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to fetch contacts");
      return response.body;
    },
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export function contactsInfiniteQueryOptions(query: Record<string, unknown> = {}) {
  return infiniteQueryOptions({
    queryKey: [...CONTACTS_QUERY_KEY, "contract-infinite-list", query] as const,
    queryFn: async ({ pageParam, signal }) => {
      const effectiveQuery = { ...query, page: pageParam };
      const response = await apiContract.contacts.list({
        query: effectiveQuery as unknown as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to fetch contacts");
      return response.body as ContactsListPageResult;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    staleTime: 15_000,
  });
}

export function useContactsInfiniteList(query: Record<string, unknown> = {}, enabled = true) {
  return useInfiniteQuery({
    ...contactsInfiniteQueryOptions(query),
    enabled,
  });
}

export function useContactsContractList(query: Record<string, unknown>, enabled = true) {
  return tsrClient.contacts.list.useQuery({
    queryKey: [...CONTACTS_QUERY_KEY, "contract-list", query],
    queryData: { query: query as Record<string, unknown> },
    placeholderData: (prev: unknown) => prev,
    staleTime: 15_000,
    enabled,
  });
}

export function useContactsContractGet(id: string, enabled = true) {
  return tsrClient.contacts.get.useQuery({
    queryKey: [...CONTACTS_QUERY_KEY, "detail", id],
    queryData: { params: { id } },
    enabled,
    staleTime: 30_000,
  });
}

export function useContactsContractReportAnalytics(
  query: { years?: number[]; lang?: string },
  enabled = true,
) {
  return tsrClient.contacts.reportAnalytics.useQuery({
    queryKey: [...CONTACTS_REPORT_ANALYTICS_QUERY_KEY, query],
    queryData: { query },
    enabled,
    staleTime: 60_000,
  });
}

export function useContactsContractCreate() {
  const queryClient = useQueryClient();
  return tsrClient.contacts.create.useMutation({
    onSuccess: () => invalidateContactsQueries(queryClient),
  });
}

export function useContactsContractUpdate() {
  const queryClient = useQueryClient();
  return tsrClient.contacts.update.useMutation({
    onSuccess: () => invalidateContactsQueries(queryClient),
  });
}

export function useContactsContractDelete() {
  const queryClient = useQueryClient();
  return tsrClient.contacts.delete.useMutation({
    onSuccess: () => invalidateContactsQueries(queryClient),
  });
}

export function useContactsContractRestore() {
  const queryClient = useQueryClient();
  return tsrClient.contacts.restore.useMutation({
    onSuccess: () => invalidateContactsQueries(queryClient),
  });
}

export function useContactsContractBulkDelete() {
  const queryClient = useQueryClient();
  return tsrClient.contacts.bulkDelete.useMutation({
    onSuccess: () => invalidateContactsQueries(queryClient),
  });
}

export function useContactsContractBulkRestore() {
  const queryClient = useQueryClient();
  return tsrClient.contacts.bulkRestore.useMutation({
    onSuccess: () => invalidateContactsQueries(queryClient),
  });
}

export function useContactsContractLogExportAudit() {
  return tsrClient.contacts.exportAudit.useMutation({});
}

export function useContactsContractLogSetupAudit() {
  return tsrClient.contacts.setupAudit.useMutation({});
}

export function useContactsContractFieldConfig(enabled = true) {
  return tsrClient.contacts.getFieldConfig.useQuery({
    queryKey: CONTACTS_FIELD_CONFIG_QUERY_KEY,
    queryData: {},
    staleTime: 30_000,
    enabled,
  });
}

export function useContactsContractUpdateFieldConfig() {
  const queryClient = useQueryClient();
  return tsrClient.contacts.updateFieldConfig.useMutation({
    onSuccess: () => invalidateContactsQueries(queryClient),
  });
}
