import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { getPlatformErrorMessage } from "@/platform/lib/platformAuthErrors";

export const PLATFORM_WORKSPACES_QUERY_KEY = ["platform", "workspaces"] as const;

export function useResetWorkspaceAdminPassword() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<
    { success: true; subdomain: string; adminEmail: string; newPassword: string },
    Error,
    { subdomain: string; password: string; newPassword?: string }
  >({
    mutationFn: async ({ subdomain, password, newPassword }) => {
      const res = await apiContract.platform.resetWorkspaceAdminPassword({
        params: { subdomain },
        body: { password, newPassword },
      });
      if (res.status >= 400) {
        const errorBody = res.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          res.status,
          errorBody?.message || t("platform.loadFailed"),
          errorBody?.type,
        );
      }
      return res.body as {
        success: true;
        subdomain: string;
        adminEmail: string;
        newPassword: string;
      };
    },
    onSuccess: (res) => {
      notify.success(t("platform.resetPasswordSuccess"), {
        description: `${res.adminEmail} (${res.subdomain})`,
      });
      void queryClient.invalidateQueries({ queryKey: PLATFORM_WORKSPACES_QUERY_KEY });
    },
    onError: (error) => {
      notify.error(getPlatformErrorMessage(error, t, undefined, "platform.loadFailed"));
    },
  });
}

export function useCreateWorkspaceAdmin() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<
    { success: true; subdomain: string; adminEmail: string; name: string; initialPassword: string },
    Error,
    { subdomain: string; name: string; email: string; password?: string; currentPassword: string }
  >({
    mutationFn: async ({ subdomain, name, email, password, currentPassword }) => {
      const res = await apiContract.platform.createWorkspaceAdminUser({
        params: { subdomain },
        body: { name, email, password, currentPassword },
      });
      if (res.status >= 400) {
        const errorBody = res.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          res.status,
          errorBody?.message || t("platform.loadFailed"),
          errorBody?.type,
        );
      }
      return res.body as {
        success: true;
        subdomain: string;
        adminEmail: string;
        name: string;
        initialPassword: string;
      };
    },
    onSuccess: (res) => {
      notify.success(t("platform.adminCreatedSuccess"), {
        description: `${res.name} <${res.adminEmail}>`,
      });
      void queryClient.invalidateQueries({ queryKey: PLATFORM_WORKSPACES_QUERY_KEY });
    },
    onError: (error) => {
      notify.error(getPlatformErrorMessage(error, t, undefined, "platform.loadFailed"));
    },
  });
}
