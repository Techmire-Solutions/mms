import { apiContract } from "@/lib/api";
import type { LlmConfig, LlmTestResult } from "@mms/shared";

export function computeNextLlmConfigs(
  configs: LlmConfig[],
  nextConfig: LlmConfig,
  isEditing: boolean,
): LlmConfig[] {
  let updatedConfigs = [...configs];

  if (nextConfig.isDefaultText) {
    updatedConfigs = updatedConfigs.map((config) => ({ ...config, isDefaultText: false }));
  }

  if (isEditing) {
    updatedConfigs = updatedConfigs.map((config) =>
      config.id === nextConfig.id ? nextConfig : config,
    );
  } else {
    updatedConfigs.push(nextConfig);
  }

  if (updatedConfigs.length > 0 && !updatedConfigs.some((config) => config.isDefaultText)) {
    updatedConfigs[0] = { ...updatedConfigs[0], isDefaultText: true };
  }

  return updatedConfigs;
}

export async function testLlmConnectivity(
  customConfig: LlmConfig,
  fallbackError: string,
): Promise<LlmTestResult> {
  try {
    const res = await apiContract.ai.test({
      body: {
        prompt: "Test connectivity check",
        customConfig,
      },
    });
    const status = res.status;
    const body = res.body as LlmTestResult;
    if (status !== 200) {
      throw new Error(body.message || "Failed to test connection");
    }
    return body;
  } catch (err: unknown) {
    return {
      success: false,
      message: (err instanceof Error ? err.message : undefined) || fallbackError,
    };
  }
}
