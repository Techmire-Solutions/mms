/** Stable barrel — list + analytics query hooks (Contacts-shaped split). */
export {
  fetchAllStudentsForQuery,
  useStudentLinkedContactIds,
  useStudentsByIds,
} from "@/tenant/features/students/hooks/useStudentsListQueries";

export {
  studentsCommandMetricsQueryOptions,
  useStudentNextGrNumber,
  checkStudentRegistrationDuplicate,
  useStudentsMetrics,
  useStudentsWidgetAggregates,
} from "@/tenant/features/students/hooks/useStudentsAnalyticsQueries";

// --- Contract-driven list queryOptions & mutation hooks ------------------------------

import { apiContract, tsrClient } from "@/lib/api";
import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { StudentsListPageResult } from "@mms/shared";
import { STUDENTS_QUERY_KEY } from "@/tenant/features/students/hooks/studentsQueryKeys";
import { invalidateStudentsQueries } from "@/tenant/features/students/hooks/invalidateStudentsQueries";
import { SESSIONS_QUERY_KEY } from "@/tenant/hooks/collections/sessions";
import { assertContractOk } from "@/lib/apiContractError";

const studentsClient = tsrClient.students;

export interface StudentsContractQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sessionId?: string;
  className?: string;
  relatedContactIds?: string;
  fatherName?: string;
  excludeId?: string;
  afterId?: string;
  skipCount?: boolean;
  [key: string]: unknown;
}

export function studentsListQueryOptions(query: StudentsContractQueryParams = {}) {
  return queryOptions({
    queryKey: [...STUDENTS_QUERY_KEY, "contract", query] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.students.list({
        query: query as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to fetch students");
      return response.body as StudentsListPageResult;
    },
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export function studentsInfiniteQueryOptions(query: StudentsContractQueryParams = {}) {
  return infiniteQueryOptions({
    queryKey: [...STUDENTS_QUERY_KEY, "contract-infinite-list", query] as const,
    queryFn: async ({ pageParam, signal }) => {
      const effectiveQuery = { ...query, page: pageParam };
      const response = await apiContract.students.list({
        query: effectiveQuery as unknown as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to fetch students");
      return response.body as StudentsListPageResult;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    staleTime: 15_000,
  });
}

export function useStudentsInfiniteList(query: StudentsContractQueryParams = {}, enabled = true) {
  return useInfiniteQuery({
    ...studentsInfiniteQueryOptions(query),
    enabled,
  });
}

export function useStudentsContractList(query: StudentsContractQueryParams, enabled = true) {
  return studentsClient.list.useQuery({
    queryKey: [...STUDENTS_QUERY_KEY, "contract", query],
    queryData: { query },
    staleTime: 15_000,
    enabled,
  });
}

export function useStudentsContractCreate() {
  const queryClient = useQueryClient();
  return studentsClient.create.useMutation({
    onSuccess: () => invalidateStudentsQueries(queryClient),
  });
}

export function useStudentsContractUpdate() {
  const queryClient = useQueryClient();
  return studentsClient.update.useMutation({
    onSuccess: () => invalidateStudentsQueries(queryClient),
  });
}

export function useStudentsContractDelete() {
  const queryClient = useQueryClient();
  return studentsClient.delete.useMutation({
    onSuccess: () => invalidateStudentsQueries(queryClient),
  });
}

export function useStudentsContractBulkStatus() {
  const queryClient = useQueryClient();
  return studentsClient.bulkStatus.useMutation({
    onSuccess: () => invalidateStudentsQueries(queryClient),
  });
}

export function useStudentsContractBulkEnroll() {
  const queryClient = useQueryClient();
  return studentsClient.bulkEnroll.useMutation({
    onSuccess: () => {
      void invalidateStudentsQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
    },
  });
}

export function useStudentsContractNextGrNumber(
  query: {
    registeredDate: string;
    template?: string;
    digits?: number;
    restartAnnually?: "true" | "false";
  },
  enabled = true,
) {
  return studentsClient.nextGrNumber.useQuery({
    queryKey: [...STUDENTS_QUERY_KEY, "next-gr", query],
    queryData: { query },
    staleTime: 0,
    enabled,
  });
}

export function useStudentsContractDuplicateCheck() {
  return studentsClient.duplicateCheck.useMutation({});
}

export function useStudentsContractRestore() {
  const queryClient = useQueryClient();
  return studentsClient.restore.useMutation({
    onSuccess: () => invalidateStudentsQueries(queryClient),
  });
}

export function useStudentsContractBulkDelete() {
  const queryClient = useQueryClient();
  return studentsClient.bulkDelete.useMutation({
    onSuccess: () => invalidateStudentsQueries(queryClient),
  });
}

export function useStudentsContractBulkRestore() {
  const queryClient = useQueryClient();
  return studentsClient.bulkRestore.useMutation({
    onSuccess: () => invalidateStudentsQueries(queryClient),
  });
}

export function useStudentsContractLogExportAudit() {
  return studentsClient.exportAudit.useMutation({});
}

export function useStudentsContractLogSetupAudit() {
  return studentsClient.setupAudit.useMutation({});
}
