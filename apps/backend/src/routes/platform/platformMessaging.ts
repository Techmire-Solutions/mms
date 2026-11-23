import type { FastifyInstance, FastifyReply } from "fastify";
import {
  platformMessageSendInputSchema,
  platformMessagesListQuerySchema,
  platformMessageTemplateSaveInputSchema,
  resourceIdParamsSchema,
} from "@mms/shared";
import {
  authenticatePlatform,
  requirePlatformPermission,
  type PlatformAuthenticatedRequest,
} from "../../middleware/authenticatePlatform.js";
import { sendDatabaseError, sendIfHttpDomainError } from "../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../lib/zodRequest.js";
import { platformMessagingUseCases } from "../../platform/use-cases/platformMessagingUseCases.js";

function sendError(reply: FastifyReply, error: unknown, fallback: string) {
  const typed = error as { statusCode?: number; type?: string; message?: string };
  if (typed.statusCode && typed.type) {
    return reply
      .status(typed.statusCode)
      .send({ type: typed.type, message: typed.message ?? fallback });
  }
  return sendIfHttpDomainError(reply, error) ?? sendDatabaseError(reply, fallback, error);
}

/** Platform broadcast messaging + templates. */
export default async function platformMessagingRoutes(fastify: FastifyInstance): Promise<void> {
  const guard = { preHandler: [authenticatePlatform, requirePlatformPermission("messaging")] };

  fastify.get("/api/platform/messages/metrics", guard, async (_request, reply) => {
    try {
      return reply.send({ metrics: await platformMessagingUseCases.metrics() });
    } catch (error) {
      return sendError(reply, error, "Failed to load messaging metrics");
    }
  });

  fastify.get("/api/platform/messages", guard, async (request, reply) => {
    const query = parseRequest(platformMessagesListQuerySchema, request.query);
    if (!query.ok) return replyValidationError(reply, query.message);
    try {
      const messages = await platformMessagingUseCases.listMessages(query.data);
      return reply.send({ messages });
    } catch (error) {
      return sendError(reply, error, "Failed to list messages");
    }
  });

  fastify.post("/api/platform/messages", guard, async (request, reply) => {
    const body = parseRequest(platformMessageSendInputSchema, request.body);
    if (!body.ok) return replyValidationError(reply, body.message);
    const user = (request as PlatformAuthenticatedRequest).platformUser;
    try {
      const message = await platformMessagingUseCases.send(
        { id: user.id, email: user.email },
        body.data,
      );
      return reply.status(201).send({ message });
    } catch (error) {
      return sendError(reply, error, "Failed to send message");
    }
  });

  fastify.get("/api/platform/messages/templates", guard, async (_request, reply) => {
    try {
      return reply.send({ templates: await platformMessagingUseCases.listTemplates() });
    } catch (error) {
      return sendError(reply, error, "Failed to list templates");
    }
  });

  fastify.put("/api/platform/messages/templates/:id", guard, async (request, reply) => {
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    const body = parseRequest(platformMessageTemplateSaveInputSchema, request.body);
    if (!body.ok) return replyValidationError(reply, body.message);
    const user = (request as PlatformAuthenticatedRequest).platformUser;
    try {
      const template = await platformMessagingUseCases.saveTemplate(
        { id: user.id, email: user.email },
        params.data.id,
        body.data,
      );
      return reply.send({ template });
    } catch (error) {
      return sendError(reply, error, "Failed to save template");
    }
  });

  fastify.delete("/api/platform/messages/templates/:id", guard, async (request, reply) => {
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    const user = (request as PlatformAuthenticatedRequest).platformUser;
    try {
      await platformMessagingUseCases.deleteTemplate(
        { id: user.id, email: user.email },
        params.data.id,
      );
      return reply.send({ success: true });
    } catch (error) {
      return sendError(reply, error, "Failed to delete template");
    }
  });
}
