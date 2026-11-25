import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PlatformUserProfile } from "@mms/contracts";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { usePlatformAuth } from "@/platform/features/auth/lib/PlatformAuthContext";
import { useTranslation } from "@mms/fe-core/i18n";
import { notify } from "@/lib/notify";
import { getPlatformErrorMessage } from "@/platform/features/auth/lib/platformAuthErrors";
import { assertContractOk } from "@/lib/apiContractError";
import { PLATFORM_PROFILE_QUERY_KEY } from "@/platform/features/shell/lib/platformQueryKeys";

export { PLATFORM_PROFILE_QUERY_KEY } from "@/platform/features/shell/lib/platformQueryKeys";

function updateProfileCache(old: unknown, user: PlatformUserProfile): unknown {
  if (!old || typeof old !== "object") return old;
  const asTsr = old as { body?: { user?: PlatformUserProfile }; user?: PlatformUserProfile };
  if (asTsr.body && typeof asTsr.body === "object") {
    return {
      ...asTsr,
      body: {
        ...asTsr.body,
        user,
      },
    };
  }
  if (asTsr.user) {
    return {
      ...asTsr,
      user,
    };
  }
  return user;
}

export function usePlatformProfile(options?: { enabled?: boolean }) {
  const { isPlatformAuthenticated } = usePlatformAuth();

  const query = useQuery({
    queryKey: PLATFORM_PROFILE_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.platform.getMe({ signal, fetchOptions: { signal } });
      if (response.status !== 200) {
        const errorBody = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          errorBody?.message ?? "Failed to load platform profile",
          errorBody?.type,
        );
      }
      return (response.body as { user: PlatformUserProfile }).user;
    },
    enabled: (options?.enabled ?? true) && isPlatformAuthenticated,
    staleTime: 60_000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useUpdatePlatformProfileName() {
  const queryClient = useQueryClient();
  const { checkPlatformAuth } = usePlatformAuth();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (patch: { name?: string; phone?: string }) => {
      const body: { name?: string; phone?: string } = {};
      if (patch.name !== undefined) body.name = patch.name.trim();
      if (patch.phone !== undefined) body.phone = patch.phone.trim();
      const res = await apiContract.platform.patchMe({ body });
      assertContractOk(res, "Failed to update name");
      return (res.body as { user: PlatformUserProfile }).user;
    },
    onSuccess: async (user) => {
      queryClient.setQueryData(PLATFORM_PROFILE_QUERY_KEY, (old) => updateProfileCache(old, user));
      await checkPlatformAuth();
    },
    onError: (err) => {
      notify.error(getPlatformErrorMessage(err, t));
    },
  });
}

export function useUpdatePlatformPassword() {
  return useMutation({
    mutationFn: async ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => {
      const res = await apiContract.platform.changePassword({
        body: { currentPassword, newPassword },
      });
      assertContractOk(res, "Failed to change password");
      return res.body as { success: boolean };
    },
  });
}
