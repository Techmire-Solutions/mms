import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  PlatformModuleCatalogDto,
  PlatformModulesUpdateInput,
  PlatformSettingsDto,
} from "@mms/shared";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { assertContractOk } from "@/lib/apiContractError";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { PLATFORM_QUERY_KEYS } from "@/platform/features/shell/lib/platformQueryKeys";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { getPlatformErrorMessage } from "@/platform/features/auth/lib/platformAuthErrors";

/** Platform module catalog (availability + new-workspace defaults). */
export function usePlatformModuleCatalogQuery() {
  const { isPlatformAuthenticated, canSettings, canOnboard } = usePlatformPermissions();
  return useQuery({
    queryKey: PLATFORM_QUERY_KEYS.moduleCatalog,
    queryFn: async ({ signal }) => {
      const response = await apiContract.platform.getModuleCatalog({
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        const body = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          body?.message ?? "Failed to load module catalog",
          body?.type,
        );
      }
      return (response.body as PlatformModuleCatalogDto).modules;
    },
    enabled: isPlatformAuthenticated && (canSettings || canOnboard),
    staleTime: 30_000,
  });
}

/** Persists platform module availability/defaults. */
export function useUpdatePlatformModules() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (input: PlatformModulesUpdateInput) => {
      const res = await apiContract.platform.updateModules({ body: input });
      assertContractOk(res, "Failed to update platform modules");
      return (res.body as { settings: PlatformSettingsDto }).settings;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEYS.settings });
      void queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEYS.moduleCatalog });
    },
    onError: (error) => {
      notify.error(getPlatformErrorMessage(error, t));
    },
  });
}
