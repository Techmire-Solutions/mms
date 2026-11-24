import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { generateCompletion } from "../../services/llmService.js";
import { loadGlobalSettings } from "../../services/globalSettingsService.js";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { sendForbidden } from "../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../lib/zodRequest.js";
import {
  aiModelsBodySchema as modelsBodySchema,
  aiTestBodySchema as testBodySchema,
  type User,
  type LlmTestResult,
} from "@mms/shared";
import { fetchLlmModels } from "../../services/llmModelsService.js";
import { userHasPermission } from "../../lib/userPermissionContext.js";

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
    if (!user || !userHasPermission(user, "settings.global.write")) {
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
      const models = await fetchLlmModels({
        provider,
        apiKey: resolvedApiKey,
        baseUrl: resolvedBaseUrl,
      });
      return reply.send({ success: true, models });
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
