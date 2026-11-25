import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { User } from "@mms/contracts";
import { messagingLogsQuerySchema } from "@mms/contracts";
import { getRequestTenant } from "@mms/be-core/http";
import { sendDatabaseError, sendForbidden } from "@mms/be-core/http/errors";
import { parseRequest, replyValidationError } from "@mms/be-core/http/routes";
import { canClearMessagingLogs, canReadMessaging } from "@mms/be-core/rbac";
import { messagingUseCases } from "../use-cases/index.js";

/** Legacy GET /logs alias route for backwards compatibility with raw API callers and test suites. */
export const messagingLogRoutes: FastifyPluginAsync = async (fastify) => {
  const handleGetLogs = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user as User;
    if (!canReadMessaging(user)) return sendForbidden(reply);
    const parsedQuery = parseRequest(messagingLogsQuerySchema, req.query);
    if (!parsedQuery.ok) return replyValidationError(reply, parsedQuery.message);
    if (parsedQuery.data.includeDeleted && !canClearMessagingLogs(user)) {
      return sendForbidden(reply);
    }
    const tenantSubdomain = getRequestTenant();
    if (!tenantSubdomain) {
      return reply
        .status(400)
        .send({ type: "validation_error", message: "Tenant context required" });
    }
    const effectiveQuery = { ...parsedQuery.data };
    if (!canClearMessagingLogs(user)) {
      effectiveQuery.userId = String(user.id);
    }
    try {
      const page = await messagingUseCases.loadFilteredMessageLogs(tenantSubdomain, effectiveQuery);
      return reply.send(page);
    } catch (err) {
      return sendDatabaseError(reply, "Failed to load message logs", err);
    }
  };

  fastify.get("/logs", handleGetLogs);
};
