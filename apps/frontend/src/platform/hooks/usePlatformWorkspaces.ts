import { useQuery } from "@tanstack/react-query";
import type { PlatformWorkspaceListResponse, PlatformWorkspacesListQuery } from "@mms/shared";
import { apiJson } from "@/lib/apiClient";
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

function buildListSearchParams(params: PlatformWorkspacesListQuery): string {
  const sp = new URLSearchParams();
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.search?.trim()) sp.set("search", params.search.trim());
  if (params.status && params.status !== "all") sp.set("status", params.status);
  if (params.sortField) sp.set("sortField", params.sortField);
  if (params.sortDir) sp.set("sortDir", params.sortDir);
  const q = sp.toString();
  return q ? `?${q}` : "";
}

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
      const res = await apiJson<PlatformWorkspaceListResponse>(
        `/api/platform/workspaces${buildListSearchParams(listParams)}`,
        { signal },
      );
      return res;
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
