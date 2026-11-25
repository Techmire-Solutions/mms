import {
  type LlmConfig,
  type LlmProviderType,
  type LlmTestResult,
  type PlatformLlmTestBody,
  type PlatformLlmUpdateInput,
  type PlatformSettings,
} from "@mms/contracts";
import { fetchLlmModels } from "../llmModelsService.js";
import { generateCompletion } from "../llmService.js";
import {
  getPlatformDefaultLlmConfig,
  getPlatformSettings,
  updatePlatformSettings,
} from "./platformSettingsService.js";

/** Persists platform AI provider configuration (secrets encrypted upstream). */
export async function updatePlatformLlm(input: PlatformLlmUpdateInput): Promise<PlatformSettings> {
  return updatePlatformSettings({
    ...(input.llmProvider === undefined ? {} : { llmProvider: input.llmProvider }),
    ...(input.llmApiKey === undefined ? {} : { llmApiKey: input.llmApiKey }),
    ...(input.llmConfigs === undefined ? {} : { llmConfigs: input.llmConfigs }),
    ...(input.expectedUpdatedAt === undefined
      ? {}
      : { expectedUpdatedAt: input.expectedUpdatedAt }),
  });
}

function findStoredConfig(configId?: string): LlmConfig | null {
  if (!configId) return null;
  return getPlatformSettings().llmConfigs.find((config) => config.id === configId) ?? null;
}

/** Resolves a test config from an unsaved modal config, a stored id, or the default. */
function resolveTestConfig(body: PlatformLlmTestBody): LlmConfig | null {
  if (body.customConfig) return body.customConfig;
  return findStoredConfig(body.configId) ?? getPlatformDefaultLlmConfig();
}

/** Tests the platform AI connection with the resolved provider config. */
export async function testPlatformLlm(body: PlatformLlmTestBody): Promise<LlmTestResult> {
  const config = resolveTestConfig(body);
  if (!config) {
    throw Object.assign(
      new Error("Platform AI is not configured. Add a provider and API key first."),
      { statusCode: 400, type: "validation_error" },
    );
  }

  const start = performance.now();
  const response = await generateCompletion(body.prompt?.trim() || "Reply with OK.", {
    customConfig: config,
  });
  const latencyMs = Math.round(performance.now() - start);
  return {
    configId: body.configId,
    success: true,
    response,
    metrics: {
      latencyMs,
      characterCount: response.length,
      wordCount: response.split(/\s+/).filter(Boolean).length,
    },
  };
}

/** Model discovery for the platform AI provider (uses the stored key when omitted). */
export async function listPlatformLlmModels(input: {
  provider: LlmProviderType;
  apiKey?: string;
  configId?: string;
  baseUrl?: string;
}): Promise<string[]> {
  let apiKey = input.apiKey?.trim() ?? "";
  let baseUrl = input.baseUrl;
  if (!apiKey && input.configId) {
    const stored = findStoredConfig(input.configId);
    apiKey = stored?.apiKey ?? "";
    baseUrl = stored?.baseUrl ?? baseUrl;
  }
  if (!apiKey) {
    const fallback = getPlatformDefaultLlmConfig();
    if (fallback && fallback.provider === input.provider) {
      apiKey = fallback.apiKey;
      baseUrl = fallback.baseUrl ?? baseUrl;
    }
  }
  if (!apiKey) return [];
  return fetchLlmModels({ provider: input.provider, apiKey, baseUrl });
}

/** True when a platform LLM provider is configured for the AI assistant. */
export function isPlatformLlmConfigured(): boolean {
  return getPlatformDefaultLlmConfig() !== null;
}
