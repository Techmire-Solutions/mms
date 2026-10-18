import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { getPlatformErrorMessage } from "@/platform/lib/platformAuthErrors";
import { PLATFORM_QUERY_KEYS } from "@/platform/lib/platformQueryKeys";

export function useWorkspaceModules(
  subdomain: string,
  open: boolean,
): {
  data: string[] | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const { isPlatformAuthenticated, canWorkspaces } = usePlatformPermissions();

  const query = useQuery({
    queryKey: PLATFORM_QUERY_KEYS.workspaceModules(subdomain),
    queryFn: async ({ signal }) => {
      const response = await apiContract.platform.getWorkspaceModules({
        params: { subdomain },
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        const errorBody = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          errorBody?.message ?? "Failed to load workspace modules",
          errorBody?.type,
        );
      }
      return (response.body as { modules: string[] }).modules;
    },
    enabled: isPlatformAuthenticated && canWorkspaces && open && !!subdomain,
    staleTime: 0,
  });

  return { data: query.data, isLoading: query.isLoading, isError: query.isError };
}

export function useUpdateWorkspaceModules() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<
    { success: true; modules: string[] },
    Error,
    { subdomain: string; modules: string[] }
  >({
    mutationFn: async ({ subdomain, modules }) => {
      const res = await apiContract.platform.updateWorkspaceModules({
        params: { subdomain },
        body: { modules },
      });
      if (res.status >= 400) {
        const errorBody = res.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          res.status,
          errorBody?.message || t("platform.loadFailed"),
          errorBody?.type,
        );
      }
      return res.body as { success: true; modules: string[] };
    },
    onSuccess: (response, variables) => {
      queryClient.setQueryData(
        PLATFORM_QUERY_KEYS.workspaceModules(variables.subdomain),
        response.modules,
      );
      notify.success(t("module.system.saved"));
    },
    onError: (error) => {
      notify.error(getPlatformErrorMessage(error, t, undefined, "platform.loadFailed"));
    },
  });
}
