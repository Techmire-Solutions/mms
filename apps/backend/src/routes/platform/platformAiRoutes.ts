import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { platformAiQueryRequestSchema } from "@mms/shared";
import {
  authenticatePlatform,
  requirePlatformPermission,
  type PlatformAuthenticatedRequest,
} from "../../middleware/authenticatePlatform.js";
import { parseRequest, replyValidationError } from "../../lib/zodRequest.js";
import { synthesizePlatformAiDiagnostics } from "../../services/platform/platformAiService.js";
import { AUTH_RATE_LIMIT } from "../../lib/rateLimitConfig.js";
import { createStrictRateLimitGuard } from "../../lib/rateLimitGuard.js";
import { insertPlatformActivityLog } from "../../db/repositories/platformActivityLogsRepository.js";

export default async function platformAiRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  const aiRateLimit = createStrictRateLimitGuard(fastify, AUTH_RATE_LIMIT);

  fastify.post(
    "/query",
    {
      preHandler: [authenticatePlatform, requirePlatformPermission("system"), aiRateLimit],
    },
    async (request, reply) => {
      const parsed = parseRequest(platformAiQueryRequestSchema, request.body);
      if (!parsed.ok) {
        return replyValidationError(reply, parsed.message);
      }

      try {
        const result = await synthesizePlatformAiDiagnostics(parsed.data);
        const { platformUser } = request as PlatformAuthenticatedRequest;
        await insertPlatformActivityLog({
          userId: platformUser.id,
          userEmail: platformUser.email,
          action: "ai_query",
          targetResource: "platform_ai",
          metadataMessage: "Platform AI diagnostics query",
          ipAddress: request.ip,
        });
        return reply.send(result);
      } catch (error: unknown) {
        void error;
        return reply.status(500).send({
          type: "internal_error",
          message: "Failed to generate platform diagnostics",
        });
      }
    },
  );
}
