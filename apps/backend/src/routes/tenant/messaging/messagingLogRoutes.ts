import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { User } from "@mms/shared";
import { messagingLogsQuerySchema } from "@mms/shared";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { sendDatabaseError, sendForbidden } from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { canClearMessagingLogs, canReadMessaging } from "../../../services/rbacService.js";
import { messagingUseCases } from "../../../messaging/use-cases/messagingUseCases.js";

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
    try {
      const page = await messagingUseCases.loadFilteredMessageLogs(
        tenantSubdomain,
        parsedQuery.data,
      );
      return reply.send(page);
    } catch (err) {
      return sendDatabaseError(reply, "Failed to load message logs", err);
    }
  };

  fastify.get("/logs", handleGetLogs);
};
