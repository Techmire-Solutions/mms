import { useState, type Dispatch, type SetStateAction } from "react";
import { apiContract } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";
import type { LlmConfig, LlmTestResult } from "@mms/shared";
import type { LlmHealthStatus } from "../lib/llmSettingsControllerTypes";
import { assertContractOk } from "@/lib/apiContractError";

interface UseLlmConfigListActionsOptions {
  configs: LlmConfig[];
  upd: (key: "llmConfigs", value: LlmConfig[]) => void;
  setHealthStatuses: Dispatch<SetStateAction<Record<string, LlmHealthStatus>>>;
}

export function useLlmConfigListActions({
  configs,
  upd,
  setHealthStatuses,
}: UseLlmConfigListActionsOptions) {
  const { t } = useTranslation();
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<LlmTestResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleDeleteConfig = (configId: string) => {
    const updatedConfigs = configs.filter((config) => config.id !== configId);

    if (
      configs.find((config) => config.id === configId)?.isDefaultText &&
      updatedConfigs.length > 0
    ) {
      updatedConfigs[0] = { ...updatedConfigs[0], isDefaultText: true };
    }

    upd("llmConfigs", updatedConfigs);
    if (testResult?.configId === configId) {
      setTestResult(null);
    }
  };

  const handleTestConnection = async (configId: string) => {
    setTestingId(configId);
    setTestResult(null);

    try {
      setHealthStatuses((prev) => ({ ...prev, [configId]: "testing" }));

      const res = await apiContract.ai.test({
        body: { prompt: "Write a short greeting for a school portal.", configId },
      });
      const body = res.body as LlmTestResult;
      assertContractOk(res, "Failed to test connection");
      setTestResult({
        configId,
        success: body.success,
        response: body.response,
        message: body.message,
        metrics: body.metrics,
      });
      setHealthStatuses((prev) => ({ ...prev, [configId]: body.success ? "verified" : "failed" }));
    } catch (err: unknown) {
      setTestResult({
        configId,
        success: false,
        message:
          (err instanceof Error ? err.message : undefined) || t("settings.llmTestRequestFailed"),
      });
      setHealthStatuses((prev) => ({ ...prev, [configId]: "failed" }));
    } finally {
      setTestingId(null);
    }
  };

  return {
    searchQuery,
    setSearchQuery,
    testingId,
    testResult,
    handleDeleteConfig,
    handleTestConnection,
  };
}
