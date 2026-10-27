import type { FastifyInstance, FastifyReply } from "fastify";
import {
  consolidationGroupPutSchema,
  consolidationReportQuerySchema,
  resourceIdParamsSchema,
} from "@mms/shared";
import {
  authenticatePlatform,
  requirePlatformPermission,
  type PlatformAuthenticatedRequest,
} from "../../middleware/authenticatePlatform.js";
import { sendDatabaseError, sendIfHttpDomainError } from "../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../lib/zodRequest.js";
// Only the use-case surface: routes must never import a repository adapter
// (check:backend-boundaries, ADR-011).
import { consolidationUseCases } from "../../platform/use-cases/consolidationUseCases.js";

function sendError(reply: FastifyReply, error: unknown, fallback: string) {
  const typed = error as { statusCode?: number; type?: string; message?: string };
  if (typed.statusCode && typed.type) {
    return reply
      .status(typed.statusCode)
      .send({ type: typed.type, message: typed.message ?? fallback });
  }
  return sendIfHttpDomainError(reply, error) ?? sendDatabaseError(reply, fallback, error);
}

/**
 * Platform Console consolidation. Reading several workspaces' books is a
 * workspace-administration capability, so it requires the `workspaces` grant.
 */
export default async function platformConsolidationRoutes(fastify: FastifyInstance): Promise<void> {
  const guard = { preHandler: [authenticatePlatform, requirePlatformPermission("workspaces")] };

  fastify.get("/api/platform/consolidation/groups", guard, async (_request, reply) => {
    try {
      return reply.send({ groups: await consolidationUseCases.listGroups() });
    } catch (error) {
      return sendError(reply, error, "Failed to load consolidation groups");
    }
  });

  fastify.put("/api/platform/consolidation/groups/:id", guard, async (request, reply) => {
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    const body = parseRequest(consolidationGroupPutSchema, request.body);
    if (!body.ok) return replyValidationError(reply, body.message);
    const user = (request as PlatformAuthenticatedRequest).platformUser;
    try {
      const group = await consolidationUseCases.saveGroup(
        { id: user.id, email: user.email },
        params.data.id,
        body.data,
      );
      return reply.send({ group });
    } catch (error) {
      return sendError(reply, error, "Failed to save consolidation group");
    }
  });

  fastify.delete("/api/platform/consolidation/groups/:id", guard, async (request, reply) => {
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    const user = (request as PlatformAuthenticatedRequest).platformUser;
    try {
      await consolidationUseCases.deleteGroup({ id: user.id, email: user.email }, params.data.id);
      return reply.send({ ok: true });
    } catch (error) {
      return sendError(reply, error, "Failed to delete consolidation group");
    }
  });

  fastify.get("/api/platform/consolidation/groups/:id/report", guard, async (request, reply) => {
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    const query = parseRequest(consolidationReportQuerySchema, request.query ?? {});
    if (!query.ok) return replyValidationError(reply, query.message);
    try {
      return reply.send({
        report: await consolidationUseCases.buildConsolidationReport(params.data.id, query.data),
      });
    } catch (error) {
      return sendError(reply, error, "Failed to build consolidation report");
    }
  });
}
