import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  aiModelsBodySchema,
  platformLlmTestBodySchema,
  platformLlmUpdateSchema,
} from "@mms/shared";
import {
  authenticatePlatform,
  requirePlatformPermission,
  requirePlatformSuperUser,
  type PlatformAuthenticatedRequest,
} from "../../middleware/authenticatePlatform.js";
import { maskPlatformSettingsForClient } from "../../services/platform/platformSettingsService.js";
import {
  listPlatformLlmModels,
  testPlatformLlm,
  updatePlatformLlm,
} from "../../services/platform/platformLlmService.js";
import { parseRequest, replyValidationError } from "../../lib/zodRequest.js";
import { AUTH_RATE_LIMIT } from "../../lib/rateLimitConfig.js";
import { createStrictRateLimitGuard } from "../../lib/rateLimitGuard.js";
import { insertPlatformActivityLog } from "../../platform/use-cases/platformUseCases.js";

/** Platform AI provider configuration (super-user, rate-limited). */
export default async function platformLlmRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  const strictLimit = createStrictRateLimitGuard(fastify, AUTH_RATE_LIMIT);

  fastify.put(
    "/api/platform/llm",
    {
      preHandler: [
        authenticatePlatform,
        requirePlatformPermission("settings"),
        requirePlatformSuperUser(),
      ],
    },
    async (request, reply) => {
      const parsed = parseRequest(platformLlmUpdateSchema, request.body);
      if (!parsed.ok) return replyValidationError(reply, parsed.message);

      const { platformUser } = request as PlatformAuthenticatedRequest;
      const settings = await updatePlatformLlm(parsed.data);
      await insertPlatformActivityLog({
        userId: platformUser.id,
        userEmail: platformUser.email,
        action: "update_platform_llm",
        targetResource: "platform_llm",
        metadataMessage: "Updated platform AI provider configuration",
        ipAddress: request.ip,
      });
      return reply.send({
        settings: maskPlatformSettingsForClient(settings),
        success: true,
      });
    },
  );

  fastify.post(
    "/api/platform/llm/models",
    {
      preHandler: [
        strictLimit,
        authenticatePlatform,
        requirePlatformPermission("settings"),
        requirePlatformSuperUser(),
      ],
    },
    async (request, reply) => {
      const parsed = parseRequest(aiModelsBodySchema, request.body);
      if (!parsed.ok) return replyValidationError(reply, parsed.message);
      try {
        const models = await listPlatformLlmModels(parsed.data);
        return reply.send({ success: true, models });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return reply.send({ success: false, message, models: [] });
      }
    },
  );

  fastify.post(
    "/api/platform/llm/test",
    {
      preHandler: [
        strictLimit,
        authenticatePlatform,
        requirePlatformPermission("settings"),
        requirePlatformSuperUser(),
      ],
    },
    async (request, reply) => {
      const parsed = parseRequest(platformLlmTestBodySchema, request.body);
      if (!parsed.ok) return replyValidationError(reply, parsed.message);
      try {
        return reply.send(await testPlatformLlm(parsed.data));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to test AI provider";
        return replyValidationError(reply, message, { success: false });
      }
    },
  );
}
