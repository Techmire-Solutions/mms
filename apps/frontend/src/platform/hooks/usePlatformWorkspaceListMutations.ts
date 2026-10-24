import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PlatformWorkspaceRow } from "@mms/shared";
import { apiContract } from "@/lib/api";
import { ApiError, isApiError } from "@/lib/apiClient";
import { WORKSPACE_REGISTRY_QUERY_KEY } from "@/platform/hooks/useWorkspaceRegistry";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { getPlatformErrorMessage } from "@/platform/lib/platformAuthErrors";
import { updateWorkspacesCache } from "./platformWorkspacesCache";
import {
  PLATFORM_WORKSPACES_QUERY_KEY,
  PLATFORM_WORKSPACE_METRICS_QUERY_KEY,
} from "@/platform/lib/platformQueryKeys";

function invalidateWorkspaceQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: PLATFORM_WORKSPACES_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: PLATFORM_WORKSPACE_METRICS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: WORKSPACE_REGISTRY_QUERY_KEY });
}

export function useSetWorkspaceEnabled() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<
    { workspace: PlatformWorkspaceRow },
    Error,
    { subdomain: string; enabled: boolean },
    { previousEntries: [unknown, unknown][] }
  >({
    mutationFn: async ({ subdomain, enabled }) => {
      const res = await apiContract.platform.patchWorkspace({
        params: { subdomain },
        body: { enabled },
      });
      if (res.status >= 400) {
        const errorBody = res.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          res.status,
          errorBody?.message || t("platform.workspaceToggleFailed"),
          errorBody?.type,
        );
      }
      return res.body as { workspace: PlatformWorkspaceRow };
    },
    onMutate: async ({ subdomain, enabled }) => {
      await queryClient.cancelQueries({ queryKey: PLATFORM_WORKSPACES_QUERY_KEY });
      const previousEntries = queryClient.getQueriesData({
        queryKey: PLATFORM_WORKSPACES_QUERY_KEY,
      });
      queryClient.setQueriesData({ queryKey: PLATFORM_WORKSPACES_QUERY_KEY }, (old) =>
        updateWorkspacesCache(old, subdomain, { enabled }),
      );
      return { previousEntries };
    },
    onSuccess: (_res, variables) => {
      notify.success(
        variables.enabled
          ? t("platform.workspaceEnabledToast")
          : t("platform.workspaceDisabledToast"),
        { description: variables.subdomain },
      );
    },
    onError: (error, _variables, context) => {
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries) {
          queryClient.setQueryData(key as readonly unknown[], data);
        }
      }
      notify.error(getPlatformErrorMessage(error, t, undefined, "platform.workspaceToggleFailed"));
    },
    onSettled: () => {
      invalidateWorkspaceQueries(queryClient);
    },
  });
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<
    { deleted: true; subdomain: string },
    Error,
    { subdomain: string; password: string; confirmSubdomain: string }
  >({
    mutationFn: async ({ subdomain, password, confirmSubdomain }) => {
      const res = await apiContract.platform.deleteWorkspace({
        params: { subdomain },
        body: { password, confirmSubdomain },
      });
      if (res.status >= 400) {
        const errorBody = res.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          res.status,
          errorBody?.message || t("platform.loadFailed"),
          errorBody?.type,
        );
      }
      return res.body as { deleted: true; subdomain: string };
    },
    onSuccess: (_res, variables) => {
      invalidateWorkspaceQueries(queryClient);
      notify.success(t("platform.workspaceDeletedToast"), { description: variables.subdomain });
    },
    onError: (error) => {
      if (isApiError(error) && error.type === "invalid_current_password") {
        return;
      }
      notify.error(getPlatformErrorMessage(error, t, undefined, "platform.loadFailed"));
    },
  });
}

export function useSetWorkspaceEmailVerification() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<
    { success: true; subdomain: string; requireEmailVerification: boolean },
    Error,
    { subdomain: string; requireEmailVerification: boolean },
    { previousEntries: [unknown, unknown][] }
  >({
    mutationFn: async ({ subdomain, requireEmailVerification }) => {
      const res = await apiContract.platform.patchWorkspaceEmailVerification({
        params: { subdomain },
        body: { requireEmailVerification },
      });
      if (res.status >= 400) {
        const errorBody = res.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          res.status,
          errorBody?.message || t("platform.emailVerificationToggleFailed"),
          errorBody?.type,
        );
      }
      return res.body as { success: true; subdomain: string; requireEmailVerification: boolean };
    },
    onMutate: async ({ subdomain, requireEmailVerification }) => {
      await queryClient.cancelQueries({ queryKey: PLATFORM_WORKSPACES_QUERY_KEY });
      const previousEntries = queryClient.getQueriesData({
        queryKey: PLATFORM_WORKSPACES_QUERY_KEY,
      });
      queryClient.setQueriesData({ queryKey: PLATFORM_WORKSPACES_QUERY_KEY }, (old) =>
        updateWorkspacesCache(old, subdomain, { requireEmailVerification }),
      );
      return { previousEntries };
    },
    onSuccess: (_res, variables) => {
      notify.success(
        variables.requireEmailVerification
          ? t("platform.emailVerificationRequiredToast")
          : t("platform.emailVerificationOptionalToast"),
        { description: variables.subdomain },
      );
    },
    onError: (error, _variables, context) => {
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries) {
          queryClient.setQueryData(key as readonly unknown[], data);
        }
      }
      notify.error(
        getPlatformErrorMessage(error, t, undefined, "platform.emailVerificationToggleFailed"),
      );
    },
    onSettled: () => {
      invalidateWorkspaceQueries(queryClient);
    },
  });
}
