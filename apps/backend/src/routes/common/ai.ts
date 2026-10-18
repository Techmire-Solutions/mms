import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { generateCompletion } from "../../services/llmService.js";
import { loadGlobalSettings } from "../../services/globalSettingsService.js";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { sendForbidden } from "../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../lib/zodRequest.js";
import {
  getLlmProviderModelsUrl,
  aiModelsBodySchema as modelsBodySchema,
  aiTestBodySchema as testBodySchema,
  roleHasPermission,
  type User,
  type LlmTestResult,
} from "@mms/shared";
import { fetchSafeExternal, safeOptionalExternalHttpUrl } from "../../lib/outboundUrl.js";

interface GeminiModelsResponse {
  models?: Array<{ name: string }>;
}

interface AnthropicModelsResponse {
  data?: Array<{ id: string }>;
}

interface OpenAiModelsResponse {
  data?: Array<{ id: string }>;
}

export default async function aiRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  // Enforce authentication AND global-settings write access for all AI configuration
  // routes. Uses the shared permission engine (so `super_admin` is allowed and the
  // role reflects the fresh matrix role bound by authenticateTenant).
  fastify.addHook("preHandler", async (request, reply) => {
    await authenticateTenant(request, reply);
    if (reply.sent) return;

    const user = request.user as User | undefined;
    if (!user || !roleHasPermission(user.role, "settings.global.write")) {
      return sendForbidden(reply, "Admin privilege required to access AI configuration API");
    }
  });

  fastify.post("/models", async (request, reply) => {
    const parsed = parseRequest(modelsBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const { provider, apiKey, configId, baseUrl } = parsed.data;

    let resolvedApiKey = apiKey;
    let resolvedBaseUrl = baseUrl;
    if (!resolvedApiKey?.trim() && configId) {
      const settings = await loadGlobalSettings();
      const savedConfig = (settings.llmConfigs ?? []).find(
        (llmConfig) => llmConfig.id === configId,
      );
      if (savedConfig) {
        resolvedApiKey = savedConfig.apiKey;
        resolvedBaseUrl = savedConfig.baseUrl;
      }
    }

    if (!resolvedApiKey?.trim()) {
      return reply.send({ success: true, models: [] });
    }

    try {
      let models: string[] = [];
      const safeBaseUrl = safeOptionalExternalHttpUrl(resolvedBaseUrl, "AI base URL");

      if (provider === "gemini") {
        const modelsEndpoint = getLlmProviderModelsUrl("gemini", safeBaseUrl);
        const url = `${modelsEndpoint}?key=${resolvedApiKey}`;
        const res = await fetchSafeExternal(url);
        if (res.ok) {
          const json = (await res.json()) as GeminiModelsResponse;
          models = (json.models || []).map((model) => model.name.replace("models/", ""));
        }
      } else if (provider === "anthropic") {
        const url = getLlmProviderModelsUrl("anthropic", safeBaseUrl);
        const res = await fetchSafeExternal(url, {
          headers: {
            "x-api-key": resolvedApiKey,
            "anthropic-version": "2023-06-01",
          },
        });
        if (res.ok) {
          const json = (await res.json()) as AnthropicModelsResponse;
          models = (json.data || []).map((model) => model.id);
        } else {
          models = [
            "claude-3-5-haiku-20241022",
            "claude-3-5-sonnet-20241022",
            "claude-3-opus-20240229",
          ];
        }
      } else {
        const url = getLlmProviderModelsUrl(provider, safeBaseUrl);
        if (url) {
          const headers: Record<string, string> = {
            Authorization: `Bearer ${resolvedApiKey}`,
          };
          if (provider === "openrouter") {
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

      const uniqueModels = Array.from(new Set(models)).sort();
      return reply.send({ success: true, models: uniqueModels });
    } catch (caughtError: unknown) {
      const errorMessage = caughtError instanceof Error ? caughtError.message : "Unknown error";
      return reply.send({ success: false, message: errorMessage, models: [] });
    }
  });

  fastify.post("/test", async (request, reply) => {
    const parsed = parseRequest(testBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const { prompt, systemInstruction, configId, customConfig, messages } = parsed.data;

    if (!prompt?.trim() && (!messages || messages.length === 0)) {
      return replyValidationError(
        reply,
        "Prompt or messages array is required to test AI configuration",
      );
    }

    try {
      const startTime = performance.now();
      const response = await generateCompletion(prompt || "", {
        systemInstruction,
        configId,
        customConfig,
        messages,
      });
      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);
      const characterCount = response.length;
      const wordCount = response.split(/\s+/).filter(Boolean).length;

      const resultPayload: LlmTestResult = {
        success: true,
        response,
        metrics: {
          latencyMs,
          characterCount,
          wordCount,
        },
      };
      return reply.send(resultPayload);
    } catch (caughtError: unknown) {
      const errorMessage =
        caughtError instanceof Error ? caughtError.message : "Failed to generate content";
      return replyValidationError(reply, errorMessage, { success: false });
    }
  });
}
