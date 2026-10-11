import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PlatformUserProfile } from "@mms/shared";
import { apiContract } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { getPlatformErrorMessage } from "@/platform/lib/platformAuthErrors";
import { updateAdminsCache } from "./platformAdminsCache";

export const PLATFORM_ADMINS_QUERY_KEY = ["platform", "admins"] as const;

/** Soft-disable or re-enable a platform admin (password re-auth). */
export function useSetPlatformAdminDisabled() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<
    { user: PlatformUserProfile },
    Error,
    { adminId: string; disabled: boolean; password: string },
    { previousUsers: unknown }
  >({
    mutationFn: async ({ adminId, disabled, password }) => {
      const res = await apiContract.platform.setAdminDisabled({
        params: { adminId },
        body: { disabled, password },
      });
      return res.body as { user: PlatformUserProfile };
    },
    onMutate: async ({ adminId, disabled }) => {
      await queryClient.cancelQueries({ queryKey: PLATFORM_ADMINS_QUERY_KEY });
      const previousUsers = queryClient.getQueryData(PLATFORM_ADMINS_QUERY_KEY);

      queryClient.setQueryData(PLATFORM_ADMINS_QUERY_KEY, (old) =>
        updateAdminsCache(old, adminId, { disabledAt: disabled ? new Date().toISOString() : null }),
      );

      return { previousUsers };
    },
    onSuccess: (_response, variables) => {
      notify.success(
        t(variables.disabled ? "platform.disableAdminSuccess" : "platform.enableAdminSuccess"),
      );
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

/** Permanently delete a platform admin (password re-auth). */
export function useDeletePlatformAdmin() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ adminId, password }: { adminId: string; password: string }) => {
      const res = await apiContract.platform.deleteAdmin({
        params: { adminId },
        body: { password },
      });
      return res.body as { deleted: true; id: string };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PLATFORM_ADMINS_QUERY_KEY });
      notify.success(t("platform.deleteAdminSuccess"));
    },
    onError: (err) => {
      notify.error(getPlatformErrorMessage(err, t));
    },
  });
}

/** Super-user manually verifies an admin's email. */
export function useVerifyPlatformAdminEmail() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (adminId: string) => {
      const res = await apiContract.platform.verifyAdminEmail({
        params: { adminId },
      });
      if (res.status !== 200) {
        throw new Error(
          (res.body as { message?: string })?.message ?? "Failed to verify admin email",
        );
      }
      return res.body as { user: PlatformUserProfile; success: boolean };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PLATFORM_ADMINS_QUERY_KEY });
      notify.success(t("users.emailVerifiedSuccess"));
    },
    onError: (err) => {
      notify.error(getPlatformErrorMessage(err, t));
    },
  });
}
