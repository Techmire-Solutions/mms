import { getLlmProviderModelsUrl, type LlmProviderType } from "@mms/shared";
import { fetchSafeExternal, safeOptionalExternalHttpUrl } from "../lib/outboundUrl.js";

interface GeminiModelsResponse {
  models?: Array<{ name: string }>;
}

interface AnthropicModelsResponse {
  data?: Array<{ id: string }>;
}

interface OpenAiModelsResponse {
  data?: Array<{ id: string }>;
}

const ANTHROPIC_FALLBACK_MODELS = [
  "claude-3-5-haiku-20241022",
  "claude-3-5-sonnet-20241022",
  "claude-3-opus-20240229",
];

/**
 * Discovers the model list for an LLM provider without persisting anything.
 * Shared by the tenant `/api/ai/models` route and the platform LLM settings API.
 * Returns an empty list when no API key is available.
 */
export async function fetchLlmModels(input: {
  provider: LlmProviderType;
  apiKey?: string;
  baseUrl?: string;
}): Promise<string[]> {
  const apiKey = input.apiKey?.trim();
  if (!apiKey) return [];

  let models: string[] = [];
  const safeBaseUrl = safeOptionalExternalHttpUrl(input.baseUrl, "AI base URL");

  if (input.provider === "gemini") {
    const modelsEndpoint = getLlmProviderModelsUrl("gemini", safeBaseUrl);
    const url = `${modelsEndpoint}?key=${apiKey}`;
    const res = await fetchSafeExternal(url);
    if (res.ok) {
      const json = (await res.json()) as GeminiModelsResponse;
      models = (json.models || []).map((model) => model.name.replace("models/", ""));
    }
  } else if (input.provider === "anthropic") {
    const url = getLlmProviderModelsUrl("anthropic", safeBaseUrl);
    const res = await fetchSafeExternal(url, {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });
    if (res.ok) {
      const json = (await res.json()) as AnthropicModelsResponse;
      models = (json.data || []).map((model) => model.id);
    } else {
      models = [...ANTHROPIC_FALLBACK_MODELS];
    }
  } else {
    const url = getLlmProviderModelsUrl(input.provider, safeBaseUrl);
    if (url) {
      const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
      if (input.provider === "openrouter") {
        const domain = process.env.MMS_APP_DOMAIN?.trim();
        headers["HTTP-Referer"] = domain ? `https://${domain}` : "http://localhost:3000";
        headers["X-Title"] = "MMS";
      }
      const res = await fetchSafeExternal(url, { headers });
      if (res.ok) {
        const json = (await res.json()) as OpenAiModelsResponse;
        models = (json.data || []).map((model) => model.id);
      }
    }
  }

  return Array.from(new Set(models)).sort();
}
