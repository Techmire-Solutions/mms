import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  LlmProviderType,
  LlmTestResult,
  PlatformLlmTestBody,
  PlatformLlmUpdateInput,
  PlatformSettingsDto,
} from "@mms/contracts";
import { apiContract } from "@/lib/api";
import { assertContractOk } from "@/lib/apiContractError";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { PLATFORM_QUERY_KEYS } from "@/platform/features/shell/lib/platformQueryKeys";
import { getPlatformErrorMessage } from "@/platform/features/auth/lib/platformAuthErrors";

export function useUpdatePlatformLlm() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (input: PlatformLlmUpdateInput) => {
      const res = await apiContract.platform.updateLlm({ body: input });
      assertContractOk(res, "Failed to update platform AI configuration");
      return (res.body as { settings: PlatformSettingsDto }).settings;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEYS.settings });
    },
    onError: (error) => {
      notify.error(getPlatformErrorMessage(error, t));
    },
  });
}

export function useTestPlatformLlm() {
  return useMutation({
    mutationFn: async (body: PlatformLlmTestBody): Promise<LlmTestResult> => {
      const res = await apiContract.platform.testLlm({ body });
      if (res.status !== 200) {
        const responseBody = res.body as { message?: string } | undefined;
        return { success: false, message: responseBody?.message ?? "AI test failed" };
      }
      return res.body as LlmTestResult;
    },
  });
}

export function usePlatformLlmModels() {
  return useMutation({
    mutationFn: async (body: {
      provider: LlmProviderType;
      apiKey?: string;
      configId?: string;
      baseUrl?: string;
    }): Promise<string[]> => {
      const res = await apiContract.platform.getLlmModels({ body });
      if (res.status !== 200) return [];
      return (res.body as { models: string[] }).models;
    },
  });
}
