import { useQuery } from "@tanstack/react-query";
import type { PlatformWorkspaceListResponse, PlatformWorkspacesListQuery } from "@mms/shared";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { PLATFORM_QUERY_KEYS } from "@/platform/lib/platformQueryKeys";

export { PLATFORM_WORKSPACES_QUERY_KEY } from "@/platform/lib/platformQueryKeys";
export { usePlatformWorkspaceMetrics } from "./usePlatformWorkspaceMetrics";
export {
  useSetWorkspaceEnabled,
  useDeleteWorkspace,
  useSetWorkspaceEmailVerification,
} from "./usePlatformWorkspaceListMutations";
export { useWorkspaceModules, useUpdateWorkspaceModules } from "./usePlatformWorkspaceModules";
export {
  useResetWorkspaceAdminPassword,
  useCreateWorkspaceAdmin,
} from "./usePlatformWorkspaceAdminMutations";

export type PlatformWorkspacesListParams = PlatformWorkspacesListQuery;

/** Paginated platform workspace directory — params drive the query key. */
export function usePlatformWorkspaces(params: PlatformWorkspacesListParams = {}) {
  const { isPlatformAuthenticated, canWorkspaces } = usePlatformPermissions();
  const listParams: PlatformWorkspacesListQuery = {
    page: params.page ?? 1,
    limit: params.limit ?? 25,
    search: params.search,
    status: params.status,
    sortField: params.sortField,
    sortDir: params.sortDir,
  };

  const query = useQuery({
    queryKey: PLATFORM_QUERY_KEYS.workspaceList({
      page: listParams.page,
      limit: listParams.limit,
      search: listParams.search ?? "",
      status: listParams.status ?? "all",
      sortField: listParams.sortField ?? "name",
      sortDir: listParams.sortDir ?? "asc",
    }),
    queryFn: async ({ signal }) => {
      const response = await apiContract.platform.listWorkspaces({
        query: {
          page: listParams.page,
          limit: listParams.limit,
          ...(listParams.search?.trim() ? { search: listParams.search.trim() } : {}),
          ...(listParams.status && listParams.status !== "all"
            ? { status: listParams.status }
            : {}),
          ...(listParams.sortField ? { sortField: listParams.sortField } : {}),
          ...(listParams.sortDir ? { sortDir: listParams.sortDir } : {}),
        },
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        const errorBody = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          errorBody?.message ?? "Failed to load platform workspaces",
          errorBody?.type,
        );
      }
      return response.body as PlatformWorkspaceListResponse;
    },
    enabled: isPlatformAuthenticated && canWorkspaces,
    staleTime: 60_000,
  });

  return {
    data: query.data?.workspaces,
    total: query.data?.total ?? 0,
    page: query.data?.page ?? listParams.page ?? 1,
    pageSize: query.data?.pageSize ?? listParams.limit ?? 25,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
