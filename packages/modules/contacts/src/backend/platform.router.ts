import type { FastifyInstance, FastifyReply } from "fastify";
import {
  platformContactCreateInputSchema,
  platformContactUpdateInputSchema,
  platformContactsListQuerySchema,
  resourceIdParamsSchema,
} from "@mms/contracts";
import type { PlatformAuthenticatedRequest } from "@mms/be-core/auth";
import { sendDatabaseError, sendIfHttpDomainError } from "@mms/be-core/http/errors";
import { parseRequest, replyValidationError } from "@mms/be-core/http/routes";
import { platformContactsUseCases } from "./use-cases/platformContactsUseCases.js";

function sendError(reply: FastifyReply, error: unknown, fallback: string) {
  const typed = error as { statusCode?: number; type?: string; message?: string };
  if (typed.statusCode && typed.type) {
    return reply
      .status(typed.statusCode)
      .send({ type: typed.type, message: typed.message ?? fallback });
  }
  return sendIfHttpDomainError(reply, error) ?? sendDatabaseError(reply, fallback, error);
}

/** Platform contact directory (operators + workspace admins + external). */
export default async function platformContactsRoutes(fastify: FastifyInstance): Promise<void> {
  // Auth + platform permission are applied by the app composition root scope.
  const guard = {};

  fastify.get("/api/platform/contacts/metrics", guard, async (_request, reply) => {
    try {
      return reply.send({ metrics: await platformContactsUseCases.metrics() });
    } catch (error) {
      return sendError(reply, error, "Failed to load contact metrics");
    }
  });

  fastify.get("/api/platform/contacts", guard, async (request, reply) => {
    const query = parseRequest(platformContactsListQuerySchema, request.query);
    if (!query.ok) return replyValidationError(reply, query.message);
    try {
      const contacts = await platformContactsUseCases.list({
        ...query.data,
        includeDeleted: query.data.deleted,
      });
      return reply.send({ contacts });
    } catch (error) {
      return sendError(reply, error, "Failed to list contacts");
    }
  });

  fastify.post("/api/platform/contacts", guard, async (request, reply) => {
    const body = parseRequest(platformContactCreateInputSchema, request.body);
    if (!body.ok) return replyValidationError(reply, body.message);
    const user = (request as PlatformAuthenticatedRequest).platformUser;
    try {
      const contact = await platformContactsUseCases.create(
        { id: user.id, email: user.email },
        body.data,
      );
      return reply.status(201).send({ contact });
    } catch (error) {
      return sendError(reply, error, "Failed to create contact");
    }
  });

  fastify.get("/api/platform/contacts/:id", guard, async (request, reply) => {
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    try {
      const contact = await platformContactsUseCases.get(params.data.id);
      if (!contact) {
        return reply.status(404).send({ type: "not_found", message: "Platform contact not found" });
      }
      return reply.send({ contact });
    } catch (error) {
      return sendError(reply, error, "Failed to load contact");
    }
  });

  fastify.put("/api/platform/contacts/:id", guard, async (request, reply) => {
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    const body = parseRequest(platformContactUpdateInputSchema, request.body);
    if (!body.ok) return replyValidationError(reply, body.message);
    const user = (request as PlatformAuthenticatedRequest).platformUser;
    try {
      const contact = await platformContactsUseCases.update(
        { id: user.id, email: user.email },
        params.data.id,
        body.data,
      );
      return reply.send({ contact });
    } catch (error) {
      return sendError(reply, error, "Failed to update contact");
    }
  });

  fastify.post("/api/platform/contacts/:id/restore", guard, async (request, reply) => {
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    const user = (request as PlatformAuthenticatedRequest).platformUser;
    try {
      await platformContactsUseCases.restore({ id: user.id, email: user.email }, params.data.id);
      return reply.send({ success: true });
    } catch (error) {
      return sendError(reply, error, "Failed to restore contact");
    }
  });

  fastify.delete("/api/platform/contacts/:id", guard, async (request, reply) => {
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    const user = (request as PlatformAuthenticatedRequest).platformUser;
    try {
      await platformContactsUseCases.softDelete({ id: user.id, email: user.email }, params.data.id);
      return reply.send({ success: true });
    } catch (error) {
      return sendError(reply, error, "Failed to delete contact");
    }
  });
}
