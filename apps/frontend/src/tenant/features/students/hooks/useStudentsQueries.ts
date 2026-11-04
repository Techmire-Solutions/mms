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

// --- Contract-driven list & mutation hooks -------------------------------------------

import { apiContract, tsrClient } from "@/lib/api";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { assertContractOk } from "@/lib/apiContractError";
import {
  studentsListQueryKey,
  type StudentsContractQueryParams,
} from "@/tenant/features/students/hooks/studentsQueryKeys";
import {
  invalidateStudentsBulkEnrollQueries,
  invalidateStudentsQueries,
} from "@/tenant/features/students/hooks/invalidateStudentsQueries";

const studentsClient = tsrClient.students;

/**
 * Canonical Students list factory — the one list cache key
 * (`studentsListQueryKey`) and the ts-rest envelope shape the hook also stores, so
 * imperative callers (`fetchQuery`) and `useStudentsContractList` share one entry.
 */
export function studentsListQueryOptions(query: StudentsContractQueryParams = {}) {
  return queryOptions({
    queryKey: studentsListQueryKey(query),
    queryFn: async ({ signal }) => {
      const response = await apiContract.students.list({
        query: query as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to fetch students");
      return response;
    },
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export function useStudentsContractList(query: StudentsContractQueryParams, enabled = true) {
  return studentsClient.list.useQuery({
    queryKey: studentsListQueryKey(query),
    queryData: { query },
    // Keep the previous page visible while a new filter/page key loads — without this
    // every keystroke swapped the directory for a skeleton (2026-11-04 review, n9).
    placeholderData: (previous: unknown) => previous,
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
    onSuccess: () => invalidateStudentsBulkEnrollQueries(queryClient),
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

export function useStudentsContractLogSetupAudit() {
  return studentsClient.setupAudit.useMutation({});
}
