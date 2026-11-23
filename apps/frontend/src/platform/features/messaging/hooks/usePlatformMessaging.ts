import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  PlatformMessageDto,
  PlatformMessageSendInput,
  PlatformMessageTemplateDto,
  PlatformMessageTemplateSaveInput,
} from "@mms/shared";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { assertContractOk } from "@/lib/apiContractError";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { PLATFORM_QUERY_KEYS } from "@/platform/features/shell/lib/platformQueryKeys";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { getPlatformErrorMessage } from "@/platform/features/auth/lib/platformAuthErrors";

export function usePlatformMessages(
  params: { channel?: string; status?: string; deleted?: boolean } = {},
) {
  const { isPlatformAuthenticated, canMessaging } = usePlatformPermissions();
  return useQuery({
    queryKey: PLATFORM_QUERY_KEYS.messages({
      ...params,
      deleted: params.deleted ? "true" : "false",
    }),
    queryFn: async ({ signal }) => {
      const response = await apiContract.platformMessaging.listMessages({
        query: {
          channel: params.channel as PlatformMessageDto["channel"] | undefined,
          status: params.status as PlatformMessageDto["status"] | undefined,
          deleted: params.deleted,
          limit: 100,
          offset: 0,
        },
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        const body = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(response.status, body?.message ?? "Failed to load messages", body?.type);
      }
      return (response.body as { messages: PlatformMessageDto[] }).messages;
    },
    enabled: isPlatformAuthenticated && canMessaging,
    staleTime: 30_000,
  });
}

export function usePlatformMessagingMetrics() {
  const { isPlatformAuthenticated, canMessaging } = usePlatformPermissions();
  return useQuery({
    queryKey: PLATFORM_QUERY_KEYS.messagingMetrics,
    queryFn: async ({ signal }) => {
      const response = await apiContract.platformMessaging.metrics({
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to load messaging metrics");
      return (response.body as { metrics: unknown }).metrics;
    },
    enabled: isPlatformAuthenticated && canMessaging,
    staleTime: 30_000,
  });
}

export function useSendPlatformMessage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (input: PlatformMessageSendInput) => {
      const response = await apiContract.platformMessaging.send({ body: input });
      assertContractOk(response, "Failed to send message");
      return (response.body as { message: PlatformMessageDto }).message;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform", "messages"] });
    },
    onError: (error) => notify.error(getPlatformErrorMessage(error, t)),
  });
}

export function useDeletePlatformMessage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiContract.platformMessaging.deleteMessage({
        params: { id },
        body: {},
      });
      assertContractOk(response, "Failed to delete message");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform", "messages"] });
    },
    onError: (error) => notify.error(getPlatformErrorMessage(error, t)),
  });
}

export function useRestorePlatformMessage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiContract.platformMessaging.restoreMessage({
        params: { id },
        body: {},
      });
      assertContractOk(response, "Failed to restore message");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform", "messages"] });
    },
    onError: (error) => notify.error(getPlatformErrorMessage(error, t)),
  });
}

export function usePlatformMessageTemplates() {
  const { isPlatformAuthenticated, canMessaging } = usePlatformPermissions();
  return useQuery({
    queryKey: PLATFORM_QUERY_KEYS.messageTemplates,
    queryFn: async ({ signal }) => {
      const response = await apiContract.platformMessaging.listTemplates({
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        const body = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          body?.message ?? "Failed to load templates",
          body?.type,
        );
      }
      return (response.body as { templates: PlatformMessageTemplateDto[] }).templates;
    },
    enabled: isPlatformAuthenticated && canMessaging,
    staleTime: 30_000,
  });
}

export function useSavePlatformMessageTemplate() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: PlatformMessageTemplateSaveInput }) => {
      const response = await apiContract.platformMessaging.saveTemplate({
        params: { id },
        body: input,
      });
      assertContractOk(response, "Failed to save template");
      return (response.body as { template: PlatformMessageTemplateDto }).template;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEYS.messageTemplates });
    },
    onError: (error) => notify.error(getPlatformErrorMessage(error, t)),
  });
}

export function useDeletePlatformMessageTemplate() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiContract.platformMessaging.deleteTemplate({
        params: { id },
        body: {},
      });
      assertContractOk(response, "Failed to delete template");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEYS.messageTemplates });
    },
    onError: (error) => notify.error(getPlatformErrorMessage(error, t)),
  });
}
