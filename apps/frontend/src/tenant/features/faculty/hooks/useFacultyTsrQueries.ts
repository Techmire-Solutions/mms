/**
 * @file useFacultyTsrQueries.ts
 * @description Contract-backed Faculty list/get/next-employee-id query hooks.
 */
import {
  FACULTY_MODULE_MANIFEST,
  type FacultyQuickFilter,
  type FacultySortField,
} from "@mms/shared";
import { apiContract, tsrClient } from "@/lib/api";
import { queryOptions } from "@tanstack/react-query";
import { FACULTY_QUERY_KEY } from "@/tenant/features/faculty/hooks/facultyQueryKeys";
import {
  facultyListQueryKeyParams,
  facultyPaginatedQueryKey,
  sameFacultyListFilters,
  type FacultyPaginatedParams,
} from "@/tenant/features/faculty/hooks/facultyListQueryBuilders";

function facultyPaginatedParamsFromRecord(query: Record<string, unknown>): FacultyPaginatedParams {
  const page = typeof query.page === "number" ? query.page : Number(query.page ?? 1);
  const limit =
    typeof query.limit === "number"
      ? query.limit
      : Number(query.limit ?? FACULTY_MODULE_MANIFEST.defaultPageSize);
  return {
    page: Number.isFinite(page) ? page : 1,
    limit: Number.isFinite(limit) ? limit : FACULTY_MODULE_MANIFEST.defaultPageSize,
    search: typeof query.search === "string" ? query.search : undefined,
    status: typeof query.status === "string" ? query.status : undefined,
    specialization: typeof query.specialization === "string" ? query.specialization : undefined,
    gender: typeof query.gender === "string" ? query.gender : undefined,
    department: typeof query.department === "string" ? query.department : undefined,
    designation: typeof query.designation === "string" ? query.designation : undefined,
    reportingFacultyId:
      typeof query.reportingFacultyId === "string" ? query.reportingFacultyId : undefined,
    quickFilter:
      typeof query.quickFilter === "string" ? (query.quickFilter as FacultyQuickFilter) : undefined,
    sortField:
      typeof query.sortField === "string" ? (query.sortField as FacultySortField) : undefined,
    sortDir: query.sortDir === "desc" ? "desc" : query.sortDir === "asc" ? "asc" : undefined,
    includeDeleted: query.includeDeleted === true,
  };
}

const facultyClient = tsrClient.faculty;
const facultyApi = apiContract.faculty;

export function facultyListQueryOptions(
  query: Record<string, unknown> = {},
  messages?: { loadFailed: string },
) {
  const params = facultyPaginatedParamsFromRecord(query);
  const keyParams = facultyListQueryKeyParams(params);
  return queryOptions({
    queryKey: facultyPaginatedQueryKey(params),
    queryFn: async ({ signal }) => {
      const response = await facultyApi.list({
        query: query as Record<string, string>,
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        throw new Error(messages?.loadFailed ?? "Failed to fetch faculty");
      }
      return response.body;
    },
    placeholderData: (previousData, previousQuery) => {
      const previousKey = (previousQuery as unknown as { queryKey?: readonly unknown[] })
        ?.queryKey?.[3];
      return sameFacultyListFilters(
        previousKey as ReturnType<typeof facultyListQueryKeyParams> | undefined,
        keyParams,
      )
        ? previousData
        : undefined;
    },
    staleTime: 15_000,
  });
}

/** Contract-backed paginated list. */
export function useFacultyContractList(query: Record<string, unknown>, enabled = true) {
  const params = facultyPaginatedParamsFromRecord(query);
  const keyParams = facultyListQueryKeyParams(params);
  return facultyClient.list.useQuery({
    queryKey: facultyPaginatedQueryKey(params),
    queryData: { query },
    staleTime: 15_000,
    enabled,
    placeholderData: (previousData: unknown, previousQuery: unknown) => {
      const previousKey = (previousQuery as unknown as { queryKey?: readonly unknown[] })
        ?.queryKey?.[3];
      return sameFacultyListFilters(
        previousKey as ReturnType<typeof facultyListQueryKeyParams> | undefined,
        keyParams,
      )
        ? previousData
        : undefined;
    },
  });
}

/** Contract-backed get by ID. */
export function useFacultyContractGet(id: string, enabled = true) {
  return facultyClient.get.useQuery({
    queryKey: [...FACULTY_QUERY_KEY, "contract-get", id],
    queryData: { params: { id } },
    enabled,
    staleTime: 30_000,
  });
}

/** Contract-backed next employee ID query. */
export function useFacultyContractNextEmployeeId(query: { prefix?: string }, enabled = true) {
  return facultyClient.nextEmployeeId.useQuery({
    queryKey: [...FACULTY_QUERY_KEY, "next-employee-id", query],
    queryData: { query },
    enabled,
    staleTime: 0,
  });
}
