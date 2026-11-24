import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PlatformBrandingDto, PlatformBrandingSaveInput } from "@mms/contracts";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { assertContractOk } from "@/lib/apiContractError";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { PLATFORM_QUERY_KEYS } from "@/platform/features/shell/lib/platformQueryKeys";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { getPlatformErrorMessage } from "@/platform/features/auth/lib/platformAuthErrors";
import { hydratePlatformBranding } from "@/lib/branding/platformBrandingStore";

/** Current platform branding (white-label identity + appearance). */
export function usePlatformBrandingQuery() {
  const { isPlatformAuthenticated, canSettings } = usePlatformPermissions();
  return useQuery({
    queryKey: PLATFORM_QUERY_KEYS.branding,
    queryFn: async ({ signal }) => {
      const response = await apiContract.platform.getBranding({ signal, fetchOptions: { signal } });
      if (response.status !== 200) {
        const body = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          body?.message ?? "Failed to load platform branding",
          body?.type,
        );
      }
      return (response.body as { branding: PlatformBrandingDto }).branding;
    },
    enabled: isPlatformAuthenticated && canSettings,
    staleTime: 30_000,
  });
}

/** Saves branding + the instance theme mode, then refreshes the runtime store. */
export function useUpdatePlatformBranding() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (input: PlatformBrandingSaveInput) => {
      const res = await apiContract.platform.updateBranding({ body: input });
      assertContractOk(res, "Failed to update platform branding");
      return (res.body as { branding: PlatformBrandingDto }).branding;
    },
    onSuccess: (branding) => {
      queryClient.setQueryData(PLATFORM_QUERY_KEYS.branding, branding);
      void queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEYS.branding });
      void queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEYS.settings });
      // Public endpoint carries the saved themeMode as well as branding.
      void hydratePlatformBranding(true);
    },
    onError: (error) => {
      notify.error(getPlatformErrorMessage(error, t));
    },
  });
}
