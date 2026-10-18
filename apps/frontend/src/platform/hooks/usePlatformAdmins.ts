import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  PlatformAdminPermissions,
  PlatformCreateAdminInput,
  PlatformUserProfile,
} from "@mms/shared";
import { apiContract } from "@/lib/api";
import { usePlatformAuth } from "@/platform/lib/PlatformAuthContext";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { getPlatformErrorMessage } from "@/platform/lib/platformAuthErrors";
import { updateAdminsCache } from "./platformAdminsCache";
import { PLATFORM_ADMINS_QUERY_KEY } from "@/platform/lib/platformQueryKeys";

export { PLATFORM_ADMINS_QUERY_KEY } from "@/platform/lib/platformQueryKeys";

/** Hook for super-users to retrieve the list of platform operators. */
export function usePlatformAdmins(): {
  data: PlatformUserProfile[] | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
} {
  const { canAdmins } = usePlatformPermissions();

  const query = useQuery({
    queryKey: PLATFORM_ADMINS_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const res = await apiContract.platform.listAdmins({
        fetchOptions: { signal },
      });
      if (res.status !== 200) {
        throw new Error((res.body as { message?: string })?.message ?? "Failed to list admins");
      }
      return (res.body as { users: PlatformUserProfile[] }).users;
    },
    enabled: canAdmins,
    staleTime: 60_000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}

/** Hook for super-users to create/invite new platform administrators. */
export function useAddPlatformAdmin() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (adminData: PlatformCreateAdminInput) => {
      const res = await apiContract.platform.createAdmin({ body: adminData });
      return res.body as { user: PlatformUserProfile };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PLATFORM_ADMINS_QUERY_KEY });
      notify.success(t("platform.addAdminSuccess"));
    },
    onError: (err) => {
      notify.error(getPlatformErrorMessage(err, t));
    },
  });
}

/** Super-user updates an admin's grantable permissions. */
export function useUpdatePlatformAdminPermissions() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { checkPlatformAuth, platformUser } = usePlatformAuth();

  return useMutation<
    { user: PlatformUserProfile },
    Error,
    { adminId: string; permissions: PlatformAdminPermissions; password: string },
    { previousUsers: unknown }
  >({
    mutationFn: async ({ adminId, permissions, password }) => {
      const res = await apiContract.platform.updateAdminPermissions({
        params: { adminId },
        body: { permissions, password },
      });
      return res.body as { user: PlatformUserProfile };
    },
    onMutate: async ({ adminId, permissions }) => {
      await queryClient.cancelQueries({ queryKey: PLATFORM_ADMINS_QUERY_KEY });
      const previousUsers = queryClient.getQueryData(PLATFORM_ADMINS_QUERY_KEY);

      queryClient.setQueryData(PLATFORM_ADMINS_QUERY_KEY, (old) =>
        updateAdminsCache(old, adminId, { permissions }),
      );

      return { previousUsers };
    },
    onSuccess: async (response) => {
      notify.success(t("platform.adminAccessUpdated"));
      if (platformUser?.id === response.user.id) {
        await checkPlatformAuth();
      }
    },
    onError: (err, _variables, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(PLATFORM_ADMINS_QUERY_KEY, context.previousUsers);
      }
      notify.error(getPlatformErrorMessage(err, t));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: PLATFORM_ADMINS_QUERY_KEY });
    },
  });
}

export {
  useSetPlatformAdminDisabled,
  useDeletePlatformAdmin,
  useVerifyPlatformAdminEmail,
} from "./usePlatformAdminLifecycle";
