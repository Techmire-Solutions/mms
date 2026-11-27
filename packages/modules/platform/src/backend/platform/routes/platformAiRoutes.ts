import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { platformAiQueryRequestSchema } from "@mms/contracts";
import { authenticatePlatform, requirePlatformPermission } from "../deps.js";
import { parseRequest, replyValidationError } from "@mms/be-core/http/routes";
import { synthesizePlatformAiDiagnostics } from "../services/platformAiService.js";
import { AUTH_RATE_LIMIT } from "@mms/be-core/http/rate-limit";
import { createStrictRateLimitGuard } from "@mms/be-core/http/rate-limit";
import { insertPlatformActivityLog } from "../use-cases/platformUseCases.js";

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
        const { platformUser } = request as any;
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
